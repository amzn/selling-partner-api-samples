package lambda.utils;

import com.amazonaws.services.lambda.runtime.LambdaLogger;
import io.swagger.client.ApiException;

public class ExceptionHandling {

    public static <T> T handleException(LambdaLogger logger, Exception e) {
        if (e instanceof IllegalArgumentException) {
            logger.log("Validation Error: " + e.getMessage());
            throw (IllegalArgumentException) e;
        } else if (e instanceof ApiException) {
            ApiException apiException = (ApiException) e;
            logger.log("API Exception: " + apiException.getMessage());
            logger.log("API Response Body: " + apiException.getResponseBody());
            logger.log("API Response Code: " + apiException.getCode());
            logger.log("API Response Headers: " + apiException.getResponseHeaders());
            throw new InternalError("API Error: " + apiException.getMessage(), e);
        } else {
            logger.log("Unexpected Error: " + e.getMessage());
            throw new InternalError("Unexpected Error occurred", e);
        }
    }
}