package lambda;

import com.amazon.SellingPartnerAPIAA.LWAException;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import io.swagger.client.ApiException;
import io.swagger.client.api.ApplicationsApi;
import lambda.utils.ApiUtils;
import lambda.utils.AppCredentials;
import lambda.utils.NotificationPayload;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;

import static lambda.utils.Constants.REGION_CODE_ARN_ENV_VARIABLE;

public class RotateSecretsHandler implements RequestHandler<SQSEvent, String> {
    private final ObjectMapper mapper;

    private static final int EXPIRY_THRESHOLD_DAYS = 7;

    public RotateSecretsHandler() {
        this.mapper = new ObjectMapper();
    }

    @Override
    public String handleRequest(SQSEvent event, Context context) {
        context.getLogger().log("RotateSecretsHandler invoked with event: " + event);

        try {
            // Retrieve region code from environment variable
            String regionCode = System.getenv(REGION_CODE_ARN_ENV_VARIABLE);
            if (regionCode == null || regionCode.isEmpty()) {
                throw new IllegalArgumentException("Region code is not set in environment variables");
            }

            // Get the Applications API client
            ApplicationsApi applicationsApi = ApiUtils.getApplicationsApi(regionCode, true);

            // Get the application credentials
            AppCredentials appCredentials = ApiUtils.getApplicationCredentials();
            String storedClientId = appCredentials.getClientId();

            // Iterate through the SQS messages
            for (SQSEvent.SQSMessage message : event.getRecords()) {
                // Parse the notification payload
                NotificationPayload notificationPayload = mapNotification(message.getBody());
                context.getLogger().log("Parsed notification: " + notificationPayload);

                // Validate the notification type
                if (!"APPLICATION_OAUTH_CLIENT_SECRET_EXPIRY".equals(notificationPayload.getNotificationType())) {
                    context.getLogger().log("Skipping notification of type: " + notificationPayload.getNotificationType());
                    continue;
                }

                // Validate the clientId
                String clientId = notificationPayload.getPayload().getApplicationOAuthClientSecretExpiry().getClientId();
                if (!clientId.equals(storedClientId)) {
                    context.getLogger().log("Skipping notification for clientId: " + clientId + ", expected: " + storedClientId);
                    continue;
                }

                // Check if the client secret is expiring within the threshold
                ZonedDateTime clientSecretExpiryTime = notificationPayload.getPayload().getApplicationOAuthClientSecretExpiry().getClientSecretExpiryTime().atZoneSameInstant(ZoneId.of("UTC"));
                ZonedDateTime currentTime = ZonedDateTime.now(ZoneId.of("UTC"));
                long daysBetween = ChronoUnit.DAYS.between(currentTime, clientSecretExpiryTime);
                if (daysBetween > EXPIRY_THRESHOLD_DAYS) {
                    context.getLogger().log("Client secret not expiring within the threshold of " + EXPIRY_THRESHOLD_DAYS + " days. Skipping rotation.");
                    continue;
                }

                // Rotate the application client secret
                applicationsApi.rotateApplicationClientSecretCall(null, null);
                context.getLogger().log("Client secret rotation successful!");
            }

            return "Client secret rotation complete!";
        } catch (ApiException | IllegalArgumentException | LWAException | IOException e) {
            context.getLogger().log("Error: " + e.getMessage());
            return "Failure: " + e.getMessage();
        }
    }

    private NotificationPayload mapNotification(String messageBody) throws IOException {
        return mapper.readValue(messageBody, NotificationPayload.class);
    }
}