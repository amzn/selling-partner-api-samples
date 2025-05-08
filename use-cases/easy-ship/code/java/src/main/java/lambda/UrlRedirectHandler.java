package lambda;


import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;

import java.util.HashMap;
import java.util.Map;
import static lambda.utils.Constants.*;

public class UrlRedirectHandler implements RequestHandler<Map<String, Object>, Map<String, Object>> {

    @Override
    public Map<String, Object> handleRequest(Map<String, Object> event, Context context) {
        context.getLogger().log("UrlRedirectHandler Lambda started\n");

        @SuppressWarnings("unchecked")
        Map<String, String> pathParameters = (Map<String, String>) event.get("pathParameters");

        String orderId = pathParameters.get("orderId");
        String presignedUrl = getPresignedUrlForOrder(orderId, context);

        Map<String, Object> response = new HashMap<>();

        if (presignedUrl == null || presignedUrl.isEmpty()) {
            response.put("statusCode", 200);
            Map<String, String> headers = Map.of("Content-Type", "text/html");
            response.put("headers", headers);
            response.put("body", "<html><body><h1>Invalid Link</h1><p>This link is not valid or has expired.</p></body></html>");
            return response;
        }

        response.put("statusCode", 302);
        response.put("headers", Map.of("Location", presignedUrl));
        response.put("body", "");
        return response;
    }

    /**
     * Retrieves the presigned S3 URL (long URL) for a given Amazon order ID from DynamoDB.
     * <p>
     * The method looks up the corresponding item in the DynamoDB table using the order ID
     * as the partition key. If the item is found and contains a "url" attribute, the
     * presigned URL is returned. If not found, or if the "url" attribute is missing,
     * an empty string is returned.
     *
     * @param orderId The Amazon order ID used as the partition key in DynamoDB.
     * @param context The Lambda execution context, used for logging.
     * @return The presigned S3 URL stored in the DynamoDB table, or an empty string if not found.
     * @throws RuntimeException If any exception occurs during the DynamoDB query.
     */
    private String getPresignedUrlForOrder(String orderId, Context context) {
        //Retrieve the long URL from DynamoDB by orderId
        Map<String, AttributeValue> key = new HashMap<>();
        key.put(URL_TABLE_HASH_KEY_NAME, AttributeValue.fromS(orderId));
        GetItemRequest getItemRequest = GetItemRequest.builder()
                .tableName(System.getenv(URL_TABLE_NAME_ENV_VARIABLE))
                .key(key)
                .build();

        try {
            DynamoDbClient dynamoDB = DynamoDbClient.builder().build();
            GetItemResponse getItemResult = dynamoDB.getItem(getItemRequest);
            Map<String, AttributeValue> item = getItemResult.item();
            if (item == null || !item.containsKey("url")) {
                return "";
            }
            return item.get("url").s();
        } catch (Exception e) {
            context.getLogger().log("DynamoDB GetItem failed: " + e.getMessage());
            throw e;
        }
    }
}
