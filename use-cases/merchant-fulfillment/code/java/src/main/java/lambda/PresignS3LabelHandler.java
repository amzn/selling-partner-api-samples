package lambda;

import com.amazonaws.HttpMethod;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.amazonaws.services.s3.model.GeneratePresignedUrlRequest;
import com.amazonaws.services.s3.model.ObjectMetadata;
import io.swagger.client.model.mfn.Label;
import lambda.utils.MfnLambdaInput;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;
import java.util.zip.GZIPInputStream;

import static lambda.utils.Constants.CONTENT_TYPE_METADATA_MAP;
import static lambda.utils.Constants.LABELS_S3_BUCKET_NAME_ENV_VARIABLE;

public class PresignS3LabelHandler implements RequestHandler<MfnLambdaInput, String> {

    public String handleRequest(MfnLambdaInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("PresignS3Label Lambda input: " + input);

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
        byte[] labelContentBytes = decodeLabelContent(label);
        InputStream inputStream = new ByteArrayInputStream(labelContentBytes);

        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentType(CONTENT_TYPE_METADATA_MAP.get(label.getLabelFormat().getValue()));

        AmazonS3 s3 = AmazonS3ClientBuilder.defaultClient();
        s3.putObject(s3BucketName, objectKey, inputStream, metadata);
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
        // Set the presigned URL to expire after one hour
        Instant expirationTime = Instant.now().plusMillis(1000 * 60 * 60);
        Date expirationDate = new Date(expirationTime.toEpochMilli());

        GeneratePresignedUrlRequest generatePresignedUrlRequest =
                new GeneratePresignedUrlRequest(s3BucketName, objectKey)
                        .withMethod(HttpMethod.GET)
                        .withExpiration(expirationDate);

        AmazonS3 s3 = AmazonS3ClientBuilder.defaultClient();
        URL url = s3.generatePresignedUrl(generatePresignedUrlRequest);
        return url.toString();
    }
}
