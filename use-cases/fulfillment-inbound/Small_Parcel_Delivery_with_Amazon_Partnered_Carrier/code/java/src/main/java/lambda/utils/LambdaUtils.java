package lambda.utils;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.google.gson.Gson;
import lombok.Getter;

@Getter
public class LambdaUtils {

    private static final Gson gson = new Gson();

    private LambdaUtils() {
        // Private constructor to prevent instantiation
    }

    // Logs the input of the Lambda function.
    public static void logInput(Context context, Object input) {
        LambdaLogger logger = context.getLogger();
        logger.log("Input: " + gson.toJson(input));
    }

    // Logs the response of the Lambda function.
    public static void logResponse(Context context, Object response) {
        LambdaLogger logger = context.getLogger();
        logger.log("Response: " + gson.toJson(response));
    }

    // Logs exceptions that occurred during Lambda function execution.
    public static void logException(Context context, Exception e) {
        LambdaLogger logger = context.getLogger();
        logger.log("Exception: " + e.getMessage());
        for (StackTraceElement element : e.getStackTrace()) {
            logger.log(element.toString());
        }
    }

    // Logs a generic message.
    public static void logMessage(Context context, String message) {
        LambdaLogger logger = context.getLogger();
        logger.log(message);
    }
}
