package lambda.process.internal.orderchange.stepfunctions;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import lambda.common.ClientCredentials;

import java.util.HashMap;
import java.util.Map;

import static lambda.common.Constants.*;

/**
 * A sample Lambda handler used in a Step Functions workflow to simulate user notifications
 * based on order-related events (e.g., ORDER_CHANGE).
 *
 * This class extracts relevant information (e.g., subject, message, recipient) from the Step Functions
 * payload and logs it as if an email or message were being sent.
 *
 * <p>Note: In this sample implementation, no actual email or messaging service is invoked.
 * This is intentional to keep the solution lightweight and free of service-specific setup,
 * such as verified SES email identities or SNS/Webhook configurations.
 *
 * <p>In a production-grade implementation, {@link #invokeNotificationToUser(ClientCredentials, String, String, LambdaLogger)}
 * should be extended to perform actual delivery via services like Amazon SES, SNS, or external webhooks.
 */
public class SendNotificationHandler implements RequestHandler<Map<String, Object>, Map<String, Object>> {

    private static final Gson gson = new Gson();

    public Map<String, Object> handleRequest(Map<String, Object> input, Context context) {
        LambdaLogger logger = context.getLogger();

        logger.log(gson.toJson(input));

        String subject = (String) input.get(STEP_FUNCTION_INPUT_KEY_SUBJECT);
        String messageBody = (String) input.get(STEP_FUNCTION_INPUT_KEY_MESSAGE);
        ClientCredentials credential =
                gson.fromJson(gson.toJsonTree(input.get(STEP_FUNCTION_INPUT_KEY_CREDENTIAL)), ClientCredentials.class);

        invokeNotificationToUser(credential, subject, messageBody, logger);
        logger.log("Notification invoked successfully.");
;
        return new HashMap<>(input);
    }

    /**
     * In a production environment, this method is intended to send a notification to the user,
     * such as sending an email via Amazon SES or posting to a messaging service (e.g., SNS, webhook).
     *
     * However, in this sample solution, to keep things simple and avoid the need for additional setup
     * like verified email addresses or service subscriptions, the implementation is intentionally left empty.
     * The actual sending logic should be implemented here when used in a real-world context.
     */
    private void invokeNotificationToUser(ClientCredentials credential, String subject, String messageBody, LambdaLogger logger) {
        logger.log("Sending email...\nTo: " + credential.getMail() + "\nSubject: " + subject + "\nSubject: " + messageBody);
    }
}
