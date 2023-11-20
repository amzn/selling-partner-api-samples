package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.model.mfn.Label;
import lambda.utils.MfnLambdaInput;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import java.util.zip.GZIPInputStream;

import static lambda.utils.Constants.CONTENT_TYPE_METADATA_MAP;
import static lambda.utils.Constants.LABELS_S3_BUCKET_NAME_ENV_VARIABLE;

public class PresignS3LabelHandler implements RequestHandler<MfnLambdaInput, String> {

    public String handleRequest(MfnLambdaInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("PresignS3Label Lambda input: " + new Gson().toJson(input));

        try {
            String s3BucketName = System.getenv(LABELS_S3_BUCKET_NAME_ENV_VARIABLE);
            String objectKey = String.format("%s/%s", input.getOrderId(), UUID.randomUUID());

            //Store the label in S3
            storeLabel(s3BucketName, objectKey, input.getLabel());
            logger.log("Label successfully stored");

            //Generate a presigned url to browse the label
            String presignedUrl = generatePresignedUrl(s3BucketName, objectKey);
            logger.log("Presigned url successfully generated");

            return presignedUrl;
        } catch (Exception e) {
            throw new InternalError("Label presigned url generation failed", e);
        }
    }

    private void storeLabel(String s3BucketName, String objectKey, Label label) {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(s3BucketName)
                .key(objectKey)
                .contentType(CONTENT_TYPE_METADATA_MAP.get(label.getLabelFormat().getValue()))
                .build();

        byte[] labelContentBytes = decodeLabelContent(label);
        RequestBody body = RequestBody.fromBytes(labelContentBytes);

        S3Client s3 = S3Client.builder().build();
        s3.putObject(request, body);
    }

    //Shipping labels are compressed and encoded
    //This function decodes and decompresses the label content returned by the API
    private byte[] decodeLabelContent(Label label) {
        byte[] labelContentDecoded = Base64.getDecoder().decode(label.getFileContents().getContents());

        try {
            ByteArrayInputStream inputStream = new ByteArrayInputStream(labelContentDecoded);
            GZIPInputStream gzipInputStream = new GZIPInputStream(inputStream);
            ByteArrayOutputStream byteArrayOutputStream = new java.io.ByteArrayOutputStream();

            int res = 0;
            byte buf[] = new byte[1024];
            while (res >= 0) {
                res = gzipInputStream.read(buf, 0, buf.length);
                if (res > 0) {
                    byteArrayOutputStream.write(buf, 0, res);
                }
            }

            byte uncompressed[] = byteArrayOutputStream.toByteArray();
            return uncompressed;
        } catch (IOException e) {
            throw new InternalError("Decoding and decompressing label failed", e);
        }
    }

    private String generatePresignedUrl(String s3BucketName, String objectKey) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(s3BucketName)
                .key(objectKey)
                .build();

        // Set the presigned URL to expire after one hour
        GetObjectPresignRequest request = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(60))
                .getObjectRequest(getObjectRequest)
                .build();

        S3Presigner s3Presigner = S3Presigner.builder().build();
        PresignedGetObjectRequest result = s3Presigner.presignGetObject(request);
        return result.url().toString();
    }
}
