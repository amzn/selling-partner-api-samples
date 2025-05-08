package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.api.ReportsApi;
import io.swagger.client.model.reports.Report;
import io.swagger.client.model.reports.ReportDocument;
import lambda.utils.*;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import java.io.*;
import java.time.Duration;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.zip.GZIPInputStream;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import static io.swagger.client.model.reports.Report.ProcessingStatusEnum.DONE;
import static io.swagger.client.model.reports.Report.ProcessingStatusEnum.FATAL;
import static lambda.utils.Constants.*;

public class GetReportDocumentHandler implements RequestHandler<StateMachineInput, Map<String, String> > {

    @Override
    public Map<String, String> handleRequest(StateMachineInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("GetReportDocument Lambda input: " + new Gson().toJson(input));

        try {
            //Initialize API Client
            ReportsApi reportsApi = ApiUtils.getReportsApi(input);

            // Get reportDocumentId from ReportAPI
            String reportDocumentId = waitForReportCompletion(reportsApi, input, logger);

            // Get Report Document
            String documentUrl = getReportDocumentUrl(reportsApi, reportDocumentId, logger);

            // Download Report Document
            InputStream documentStream = HttpFileTransferUtil.download(documentUrl, null);
            // Get S3 bucket name from environment variables
            String s3BucketName = System.getenv(EASYSHIP_LABEL_S3_BUCKET_NAME_ENV_VARIABLE);
            // Generate S3 key for the document
            String objectKey = generateObjectKey(input);
            logger.log("S3 Bucket Name: " + s3BucketName + " S3 Object Key: " + objectKey);

            // Store into S3 bucket
            storeDocumentInS3(s3BucketName, objectKey, documentStream);

            // Generate a presigned url to browse the label
            String url = generatePresignedUrl(s3BucketName, objectKey, logger);

            // Store longURL to DynamoDB and generate short URL
            String shortUrl = storeToDynamoDb(input.getAmazonOrderId(), url);

            // Generate Message content
            return generateMessageContents(shortUrl, input, logger);
        } catch (Exception e) {
            throw new InternalError("GetReportDocument Request failed", e);
        }
    }

    /**
     * Generates the subject and body message content for a shipping label notification.
     *
     * @param shortUrl The short URL pointing to the presigned S3 label document.
     * @param logger   Lambda logger for writing log messages.
     * @return A map containing "subject" and "message" keys for the SNS notification.
     */
    public Map<String, String> generateMessageContents(String shortUrl, StateMachineInput input, LambdaLogger logger) {
        String pickupTime = ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) + " ~ " +
                ZonedDateTime.now().plusHours(2).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);

        // Join SKU code
        EasyShipOrder easyShipOrder = input.getEasyShipOrder();
        List<EasyShipOrderItem> orderItems = easyShipOrder.getOrderItems();
        List<String> skus = orderItems.stream()
                .map(EasyShipOrderItem::getSku)
                .collect(Collectors.toList());

        String skuJoined = String.join(", ", skus);

        // Generate subject and message
        String subject = "Label Ready - Order " + input.getAmazonOrderId();
        String message = String.format(
                "Your shipping label is ready.\nOrder Number: %s\nTime of Pickup: %s\nSku: %s\nDownload your label:\n%s",
                input.getAmazonOrderId(),
                pickupTime,
                skuJoined,
                shortUrl
        );

        logger.log("Generated message:\n" + message);

        Map<String, String> result = new HashMap<>();
        result.put("subject", subject);
        result.put("message", message);
        return result;
    }

    /**
     * Stores a mapping of the order ID to its corresponding presigned URL in DynamoDB,
     * and returns the shortened redirect URL.
     *
     * @param orderId      The Amazon order ID.
     * @param presignedUrl The presigned S3 URL to the generated label PDF.
     * @return The shortened redirect URL pointing to the stored item in DynamoDB.
     */
    private String storeToDynamoDb(String orderId, String presignedUrl) {
        DynamoDbClient dynamoDB = DynamoDbClient.builder().build();
        Map<String, AttributeValue> item = new HashMap<>();
        item.put(URL_TABLE_HASH_KEY_NAME, AttributeValue.builder().s(orderId).build());
        item.put("url", AttributeValue.builder().s(presignedUrl).build());
        item.put("createdAt", AttributeValue.builder()
                .s(ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                .build());

        PutItemRequest request = PutItemRequest.builder()
                .tableName(System.getenv(URL_TABLE_NAME_ENV_VARIABLE))
                .item(item)
                .build();

        dynamoDB.putItem(request);

        return System.getenv(SHORTLINK_BASE_URL_ENV_VARIABLE).replaceAll("/$", "") + "/" + orderId;
    }

    /**
     * Wait for the report to complete processing
     * @param reportsApi
     * @param input
     * @param logger
     * @return
     * @throws Exception
     */
    private String waitForReportCompletion(ReportsApi reportsApi, StateMachineInput input, LambdaLogger logger) throws Exception {
        int attempts = 0;

        while (attempts < MAX_RETRY_ATTEMPTS) {
            Report report = reportsApi.getReport(input.getReportId());

            if (DONE.equals(report.getProcessingStatus())) {
                logger.log("Report API - Get Report response: " + new Gson().toJson(report));
                return report.getReportDocumentId();
            }

            if (FATAL.equals(report.getProcessingStatus())) {
                throw new IOException("Get Report Process Failed!");
            }

            attempts++;
            Thread.sleep(POLLING_INTERVAL_MS);
        }
        throw new IOException("Report processing timed out after " + MAX_RETRY_ATTEMPTS + " attempts");
    }

    /**
     * Get Report Document
     * @param reportsApi
     * @param reportDocumentId
     * @param logger
     * @return
     * @throws Exception
     */
    private String getReportDocumentUrl(ReportsApi reportsApi, String reportDocumentId, LambdaLogger logger) throws Exception {
        ReportDocument document = reportsApi.getReportDocument(reportDocumentId);
        logger.log("Report API - Get Report Document response: " + new Gson().toJson(document));
        return document.getUrl();
    }

    /**
     * Generate a unique S3 key for the document
     * @param input
     * @return
     */
    private String generateObjectKey(StateMachineInput input) {
        return String.format("%s-%s-%s.pdf",
                input.getAmazonOrderId(),
                input.getMarketplaceId(),
                UUID.randomUUID());
    }

    /**
     * Store the document in S3 bucket
     * @param bucketName
     * @param objectKey
     * @param inputStream
     */
    private void storeDocumentInS3(String bucketName, String objectKey, InputStream inputStream) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             GZIPInputStream gzipIn = new GZIPInputStream(inputStream)) {

            // Decompress Document
            decompressDocument(gzipIn, baos);

            // Upload Decompressed Document
            uploadToS3(bucketName, objectKey, baos.toByteArray());

        } catch (Exception e) {
            throw new InternalError("Document storage failed", e);
        }
    }

    /**
     * Compress the document using GZIP
     * @param gzipIn
     * @param output
     * @throws IOException
     */
    private void decompressDocument(GZIPInputStream gzipIn, OutputStream output) throws IOException {
        byte[] buffer = new byte[BUFFER_SIZE];
        int bytesRead;
        while ((bytesRead = gzipIn.read(buffer)) != -1) {
            output.write(buffer, 0, bytesRead);
        }
    }

    /**
     * Upload the document to S3
     * @param bucketName
     * @param objectKey
     * @param data
     */
    private void uploadToS3(String bucketName, String objectKey, byte[] data) {
        try (S3Client s3 = S3Client.builder().build()) {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .contentType(PDF_CONTENT_TYPE)
                    .build();

            s3.putObject(request, RequestBody.fromBytes(data));
        }
    }

    /**
     * Generate a presigned URL to access the document
     * @param bucketName
     * @param objectKey
     * @param logger
     * @return
     */
    private String generatePresignedUrl(String bucketName, String objectKey, LambdaLogger logger) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(objectKey)
                .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(PRESIGNED_URL_EXPIRATION_MINUTES))
                .getObjectRequest(getObjectRequest)
                .build();

        try (S3Presigner presigner = S3Presigner.builder().build()) {
            PresignedGetObjectRequest presignedRequest = presigner.presignGetObject(presignRequest);
            logger.log("Pre-signed url successfully generated");
            return presignedRequest.url().toString();
        }
    }
}