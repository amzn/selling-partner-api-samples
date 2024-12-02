package lambda.utils;

// This class contains methods for validating the input parameters used in different Lambda functions.
public class ValidateInput {

    // Validate the input parameters for the CreateInboundPlanInput.
    public static void validateRetrieveOrderInput(StateMachineInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getAmazonOrderId() == null || input.getAmazonOrderId().isEmpty()) {
            throw new IllegalArgumentException("Amazon Order Id cannot be null or empty");
        }
        if (input.getMarketplaceId() == null || input.getMarketplaceId().isEmpty()) {
            throw new IllegalArgumentException("Marketplace Id cannot be null or empty");
        }
    }

}