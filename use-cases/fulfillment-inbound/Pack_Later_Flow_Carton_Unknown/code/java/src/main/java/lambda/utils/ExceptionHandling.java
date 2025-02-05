package lambda.utils;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.google.gson.Gson;
import io.swagger.client.ApiException;

public class ExceptionHandling {

    private static final Gson gson = new Gson();

    // Private constructor to prevent instantiation
    private ExceptionHandling() {
        throw new AssertionError("This class should not be instantiated");
    }

    // Handles exceptions by logging them and rethrowing them.
    public static <T> T handleException(Context context, Exception e) {
        LambdaLogger logger = context.getLogger();

        if (e instanceof IllegalArgumentException) {
            logValidationError(logger, (IllegalArgumentException) e);
            throw (IllegalArgumentException) e;
        } else if (e instanceof ApiException) {
            ApiException apiException = (ApiException) e;
            logApiException(logger, apiException);
            throw new InternalError(apiException.getResponseBody().trim());
        } else {
            logUnexpectedError(logger, e);
            throw new InternalError("Unexpected Error occurred", e);
        }
    }

    // Logs validation errors.
    private static void logValidationError(LambdaLogger logger, IllegalArgumentException e) {
        logger.log("Validation Error: " + e.getMessage());
    }

    // Logs API exceptions.
    private static void logApiException(LambdaLogger logger, ApiException e) {
        logger.log("API Exception: " + e.getMessage());
        logger.log("API Response Body: " + e.getResponseBody());
        logger.log("API Response Code: " + e.getCode());
        logger.log("API Response Headers: " + e.getResponseHeaders());
    }

    // Logs unexpected errors.
    private static void logUnexpectedError(LambdaLogger logger, Exception e) {
        logger.log("Unexpected Error: " + e.getMessage());
        for (StackTraceElement element : e.getStackTrace()) {
            logger.log(element.toString());
        }
    }
}