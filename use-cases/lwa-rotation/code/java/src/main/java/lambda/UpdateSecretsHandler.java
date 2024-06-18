package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.google.gson.Gson;
import lambda.utils.ApiUtils;
import lambda.utils.AppCredentials;
import lambda.utils.NotificationPayload;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.PutSecretValueRequest;

import java.io.IOException;

import static lambda.utils.Constants.REGION_CODE_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE;

public class UpdateSecretsHandler implements RequestHandler<SQSEvent, String> {
    @Override
    public String handleRequest(SQSEvent event, Context context) {
        context.getLogger().log("UpdateSecretsHandler invoked with event: " + new Gson().toJson(event));

        try {
            // Retrieve region code from environment variable
            String regionCode = System.getenv(REGION_CODE_ARN_ENV_VARIABLE);
            if (regionCode == null || regionCode.isEmpty()) {
                throw new IllegalArgumentException("Region code is not set in environment variables");
            }

            // Get the application credentials
            AppCredentials appCredentials = ApiUtils.getApplicationCredentials();
            String storedClientId = appCredentials.getClientId();

            // Iterate through the SQS messages
            for (SQSEvent.SQSMessage message : event.getRecords()) {
                // Parse the notification payload
                NotificationPayload notificationPayload = mapNotification(message.getBody());

                context.getLogger().log("Received notification: " + new Gson().toJson(notificationPayload));

                // Validate the notification type
                if (!"APPLICATION_OAUTH_CLIENT_NEW_SECRET".equals(notificationPayload.getNotificationType())) {
                    context.getLogger().log("Skipping notification of type: " + notificationPayload.getNotificationType());
                    continue;
                }

                // Validate the clientId
                String clientId = notificationPayload.getPayload().getApplicationOAuthClientNewSecret().getClientId();
                if (!clientId.equals(storedClientId)) {
                    context.getLogger().log("Skipping notification for clientId: " + clientId + ", expected: " + storedClientId);
                    continue;
                }

                // Update the new client secret in Secrets Manager
                String newClientSecret = notificationPayload.getPayload().getApplicationOAuthClientNewSecret().getNewClientSecret();
                updateSecret(clientId, newClientSecret);
            }
            return "Client secret update complete!";
        } catch (IOException e) {
            context.getLogger().log("Error: " + e.getMessage());
            return "Failure: " + e.getMessage();
        }
    }

    private NotificationPayload mapNotification(String messageBody) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.readValue(messageBody, NotificationPayload.class);
    }

    private void updateSecret(String clientId, String newClientSecret) {
        String secretArn = System.getenv(SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE);
        SecretsManagerClient client = SecretsManagerClient.builder().build();
        PutSecretValueRequest request = PutSecretValueRequest.builder()
                .secretId(secretArn)
                .secretString(String.format("{\"AppClientId\":\"%s\",\"AppClientSecret\":\"%s\"}", clientId, newClientSecret))
                .build();
        client.putSecretValue(request);
    }
}