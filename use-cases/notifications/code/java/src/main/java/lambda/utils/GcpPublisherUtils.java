package lambda.utils;

import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.gson.Gson;
import lambda.common.PubSubPublishRequest;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Collections;
import java.util.List;

import static lambda.common.Constants.*;
import static lambda.utils.SecretManagerUtils.getSecretString;

public class GcpPublisherUtils {
    private static final Gson gson = new Gson();


    /**
     * Publishes a message to a Google Cloud Pub/Sub topic using the REST API.
     *
     * <p>This method performs the following steps:
     * <ol>
     *   <li>Retrieves the GCP service account credentials JSON from AWS Secrets Manager.</li>
     *   <li>Generates a Google OAuth2 access token with the Pub/Sub scope.</li>
     *   <li>Encodes the message body as Base64 as required by the Pub/Sub REST API.</li>
     *   <li>Builds a JSON payload using a POJO model and serializes it with Gson.</li>
     *   <li>Sends the payload via HTTP POST to the Pub/Sub publish endpoint.</li>
     *   <li>Logs the HTTP response.</li>
     * </ol>
     *
     * <p>Environment variables required:
     * <ul>
     *   <li>{@code GCP_PROJECT_ID_ENV_VARIABLE}: the GCP project ID.</li>
     *   <li>{@code GCP_TOPIC_ID_ENV_VARIABLE}: the target Pub/Sub topic ID.</li>
     *   <li>{@code GCP_SPAPI_PUBSUB_KEY_ARN_ENV_VARIABLE}: the ARN of the secret storing key.json.</li>
     * </ul>
     *
     * @param messageBody The message string to publish.
     * @param logger The AWS Lambda logger for logging diagnostic output.
     * @throws Exception if any step fails (e.g., secret retrieval, token generation, or HTTP request).
     */
    public static void publishToGCPPubSub(String messageBody, LambdaLogger logger) throws Exception {
        String projectId = System.getenv(GCP_PROJECT_ID_ENV_VARIABLE);
        String topicId = System.getenv(GCP_TOPIC_ID_ENV_VARIABLE);
        String gcpSecretArn = System.getenv(GCP_SPAPI_PUBSUB_KEY_ARN_ENV_VARIABLE);

        // 1. Load key.json from Secrets Manager
        String keyJson = getSecretString(gcpSecretArn);
        logger.log("Loaded key.json from Secrets Manager");

        GoogleCredentials credentials = GoogleCredentials.fromStream(
                new ByteArrayInputStream(keyJson.getBytes(StandardCharsets.UTF_8))
        ).createScoped(Collections.singleton("https://www.googleapis.com/auth/pubsub"));
        credentials.refreshIfExpired();

        String accessToken = credentials.getAccessToken().getTokenValue();
        String encodedMessage = Base64.getEncoder().encodeToString(messageBody.getBytes(StandardCharsets.UTF_8));

        PubSubPublishRequest.Message msg = new PubSubPublishRequest.Message(encodedMessage);
        PubSubPublishRequest requestBody = new PubSubPublishRequest(List.of(msg));

        String jsonPayload = gson.toJson(requestBody);

        logger.log("JSON Payload:\n" + jsonPayload);

        String url = String.format(
                "https://pubsub.googleapis.com/v1/projects/%s/topics/%s:publish",
                projectId, topicId
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        logger.log("Response code: " + response.statusCode());
        logger.log("Response body: " + response.body());
    }
}
