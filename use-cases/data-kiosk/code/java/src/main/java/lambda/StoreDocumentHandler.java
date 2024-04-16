package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import com.squareup.okhttp.OkHttpClient;
import com.squareup.okhttp.Request;
import com.squareup.okhttp.Response;
import com.squareup.okhttp.ResponseBody;
import lambda.utils.StateMachineInput;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import static lambda.utils.Constants.DATAKIOSK_DOCUMENTS_S3_BUCKET_NAME_ENV_VARIABLE;
import static lambda.utils.Constants.QUERY_ITEMS_TABLE_ATTRIBUTE_ACCOUNT_ID;
import static lambda.utils.Constants.QUERY_ITEMS_TABLE_ATTRIBUTE_DOCUMENT_ID;
import static lambda.utils.Constants.QUERY_ITEMS_TABLE_ATTRIBUTE_DOCUMENT_S3;
import static lambda.utils.Constants.QUERY_ITEMS_TABLE_ATTRIBUTE_PROCESSING_STATUS;
import static lambda.utils.Constants.QUERY_ITEMS_TABLE_ATTRIBUTE_QUERY;
import static lambda.utils.Constants.QUERY_ITEMS_TABLE_ATTRIBUTE_QUERY_ID;
import static lambda.utils.Constants.QUERY_ITEMS_TABLE_NAME_ENV_VARIABLE;

public class StoreDocumentHandler implements RequestHandler<StateMachineInput, StateMachineInput> {

    public StateMachineInput  handleRequest(StateMachineInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("StoreDocument Lambda input: " + new Gson().toJson(input));

        try {
            // Store the document in S3 and get a URI
            String s3Uri = storeDocumentInS3(input);
            input.getDocument().setS3Uri(s3Uri);

            // Store document details in DynamoDB
            storeDocumentDetailsInDynamoDb(input);

            return input;
        } catch (Exception e) {
            throw new InternalError("Store document failed", e);
        }
    }

    private String storeDocumentInS3(StateMachineInput input) {
        // Get S3 bucket name from environment variables
        String s3BucketName = System.getenv(DATAKIOSK_DOCUMENTS_S3_BUCKET_NAME_ENV_VARIABLE);

        // Set S3 key for the document
        String objectKey = String.format("%s+%s.json", input.getAccountId(), input.getQueryId());

        try {
            String documentContent = readDocumentFromPresignedUrl(input.getDocument().getDocumentUrl());

            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(s3BucketName)
                    .key(objectKey)
                    .contentType("application/json")
                    .build();

            RequestBody body = RequestBody.fromString(documentContent, StandardCharsets.UTF_8);

            S3Client s3 = S3Client.builder().build();
            s3.putObject(request, body);

            return String.format("s3://%s/%s", s3BucketName, objectKey);
        } catch (Exception e) {
            throw new InternalError("Document storage failed", e);
        }
    }

    private String readDocumentFromPresignedUrl(String presignedUrl) throws IOException {
        OkHttpClient httpclient = new OkHttpClient();
        Request request = new Request.Builder().url(presignedUrl).get().build();

        Response response = httpclient.newCall(request).execute();
        if (!response.isSuccessful()) {
            throw new InternalError(String.format("Call to download content was unsuccessful with response code: %d and message: %s%n",
                    response.code(), response.message()));
        }

        StringBuilder content = new StringBuilder();
        try (
                ResponseBody responseBody = response.body();
                InputStream inputStream = responseBody.byteStream();
                // Note: If the Data Kiosk document is compressed, the 'Content-Encoding' header will indicate the compression algorithm
                // Most HTTP clients are capable of automatically decompressing downloaded files based on the 'Content-Encoding' header
                // More Information: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding
                //
                // The OkHttp client will automatically set the "Accept-Encoding" header and respect the
                // "Content-Encoding" header, so it is not required to unzip the stream
                // For clients which do not automatically decompress, wrapping the stream in a GZIP stream may be required, for example:
                // InputStream unzippedInputStream = new GZIPInputStream(inputStream);
                InputStreamReader inputStreamReader = new InputStreamReader(inputStream, StandardCharsets.UTF_8);
                BufferedReader reader = new BufferedReader(inputStreamReader)) {
            String line;
            while ((line = reader.readLine()) != null) {
                // Process line by line.
                content.append(line);
            }
        }

        return content.toString();
    }

    private void storeDocumentDetailsInDynamoDb(StateMachineInput input) {
        try {
            Map<String, AttributeValue> item = new HashMap<>();
            item.put(QUERY_ITEMS_TABLE_ATTRIBUTE_ACCOUNT_ID, AttributeValue.fromS(input.getAccountId()));
            item.put(QUERY_ITEMS_TABLE_ATTRIBUTE_QUERY_ID, AttributeValue.fromS(input.getQueryId()));
            item.put(QUERY_ITEMS_TABLE_ATTRIBUTE_QUERY, AttributeValue.fromS(input.getQuery()));
            item.put(QUERY_ITEMS_TABLE_ATTRIBUTE_DOCUMENT_ID, AttributeValue.fromS(input.getDocument().getDocumentId()));
            item.put(QUERY_ITEMS_TABLE_ATTRIBUTE_DOCUMENT_S3, AttributeValue.fromS(input.getDocument().getS3Uri()));
            item.put(QUERY_ITEMS_TABLE_ATTRIBUTE_PROCESSING_STATUS, AttributeValue.fromS(input.getProcessingStatus()));

            PutItemRequest putItemRequest = PutItemRequest.builder()
                    .tableName(System.getenv(QUERY_ITEMS_TABLE_NAME_ENV_VARIABLE))
                    .item(item)
                    .build();

            DynamoDbClient dynamoDB = DynamoDbClient.builder().build();
            dynamoDB.putItem(putItemRequest);
        } catch (Exception e) {
            throw new InternalError("Document metadata storage failed", e);
        }
    }
}
