package lambda.utils;

// This class contains methods for validating the input parameters used in different Lambda functions.
public class ValidateInput {

    // Validate the input parameters for the CreateInboundPlanInput.
    public static void validateCreateInboundInput(CreateInboundPlanInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getDestinationMarketplace() == null || input.getDestinationMarketplace().isEmpty()) {
            throw new IllegalArgumentException("Destination marketplace cannot be null or empty");
        }
        if (input.getMsku() == null || input.getMsku().isEmpty()) {
            throw new IllegalArgumentException("MSKU cannot be null or empty");
        }
        if (input.getLabelOwner() == null || input.getLabelOwner().isEmpty()) {
            throw new IllegalArgumentException("Label Owner cannot be null or empty");
        }
        if (input.getPrepOwner() == null || input.getPrepOwner().isEmpty()) {
            throw new IllegalArgumentException("Prep Owner cannot be null or empty");
        }
        if (input.getSourceAddress() == null) {
            throw new IllegalArgumentException("Source address cannot be null");
        }
        if (input.getInboundPlanName() == null || input.getInboundPlanName().isEmpty()) {
            throw new IllegalArgumentException("Inbound plan name cannot be null or empty");
        }
    }

    // Validate the input parameters for the OperationStatusInput.
    public static void validateOperationStatusInput(OperationStatusInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getOperationId() == null || input.getOperationId().isEmpty()) {
            throw new IllegalArgumentException("Operation ID cannot be null or empty");
        }
    }

    // Validate the input parameters for the GeneratePackingInput.
    public static void validateGeneratePackingInput(GeneratePackingInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getInboundPlanId() == null || input.getInboundPlanId().isEmpty()) {
            throw new IllegalArgumentException("Inbound plan ID cannot be null or empty");
        }
    }

    // Validate the input parameters for the ListPackingInput.
    public static void validateListPackingInput(ListPackingInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getInboundPlanId() == null || input.getInboundPlanId().isEmpty()) {
            throw new IllegalArgumentException("Inbound plan ID cannot be null or empty");
        }
    }

    // Validate the input parameters for ConfirmPackingInput.
    public static void validateConfirmPackingInput(ConfirmPackingInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getInboundPlanId() == null || input.getInboundPlanId().isEmpty()) {
            throw new IllegalArgumentException("Inbound plan ID cannot be null or empty");
        }
        if (input.getPackingOptionId() == null || input.getPackingOptionId().isEmpty()) {
            throw new IllegalArgumentException("Packing Option ID cannot be null or empty");
        }
    }

    // Validate the input parameters for the SetPackingInput.
    public static void validateSetPackingInput(SetPackingInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getInboundPlanId() == null || input.getInboundPlanId().isEmpty()) {
            throw new IllegalArgumentException("Inbound plan ID cannot be null or empty");
        }
        if (input.getPackingGroupId() == null || input.getPackingGroupId().isEmpty()) {
            throw new IllegalArgumentException("Packing Group ID cannot be null or empty");
        }
    }

    // Validate the input parameters for the GeneratePlacementInput.
    public static void validateGeneratePlacementInput(GeneratePlacementInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getInboundPlanId() == null || input.getInboundPlanId().isEmpty()) {
            throw new IllegalArgumentException("Inbound plan ID cannot be null or empty");
        }
    }

    // Validate the input parameters for the ListPlacementInput.
    public static void validateListPlacementInput(ListPlacementInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getInboundPlanId() == null || input.getInboundPlanId().isEmpty()) {
            throw new IllegalArgumentException("Inbound plan ID cannot be null or empty");
        }
    }

    // Validate the input parameters for the GenerateTransportationInput.
    public static void validateGenerateTransportationInput(GenerateTransportationInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getInboundPlanId() == null || input.getInboundPlanId().isEmpty()) {
            throw new IllegalArgumentException("Inbound plan ID cannot be null or empty");
        }
        if (input.getPlacementOptionId() == null || input.getPlacementOptionId().isEmpty()) {
            throw new IllegalArgumentException("Placement Options ID cannot be null or empty");
        }
        if (input.getShipmentId() == null || input.getShipmentId().isEmpty()) {
            throw new IllegalArgumentException("Shipment ID cannot be null or empty");
        }
        if (input.getReadyToShipWindow() == null || input.getReadyToShipWindow().isEmpty()) {
            throw new IllegalArgumentException("Ready to Ship Window Date cannot be empty and should have ISO 8601 format");
        }
    }

    // Validate the input parameters for the ListTransportationOptionsInput.
    public static void validateListTransportationInput(ListTransportationInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getInboundPlanId() == null || input.getInboundPlanId().isEmpty()) {
            throw new IllegalArgumentException("Inbound plan ID cannot be null or empty");
        }
        if (input.getPlacementOptionId() == null || input.getPlacementOptionId().isEmpty()) {
            throw new IllegalArgumentException("Placement Option ID cannot be null or empty");
        }
    }

    // Validate the input parameters for the ConfirmPlacementInput.
    public static void validateConfirmPlacementInput(ConfirmPlacementInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getInboundPlanId() == null || input.getInboundPlanId().isEmpty()) {
            throw new IllegalArgumentException("Inbound plan ID cannot be null or empty");
        }
        if (input.getPlacementOptionId() == null || input.getPlacementOptionId().isEmpty()) {
            throw new IllegalArgumentException("Placement Option ID cannot be null or empty");
        }
    }

    // Validate the input parameters for the ConfirmTransportInput.
    public static void validateConfirmTransportInput(ConfirmTransportInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getInboundPlanId() == null || input.getInboundPlanId().isEmpty()) {
            throw new IllegalArgumentException("Inbound plan ID cannot be null or empty");
        }
        if (input.getTransportationOptionId() == null || input.getTransportationOptionId().isEmpty()) {
            throw new IllegalArgumentException("Transportation Option ID cannot be null or empty");
        }
        if (input.getShipmentId() == null || input.getShipmentId().isEmpty()) {
            throw new IllegalArgumentException("Shipment ID cannot be null or empty");
        }
    }

    // Validate the input parameters for the GetShipmentInput.
    public static void validateGetShipmentInput(GetShipmentInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getInboundPlanId() == null || input.getInboundPlanId().isEmpty()) {
            throw new IllegalArgumentException("Inbound plan ID cannot be null or empty");
        }
        if (input.getShipmentId() == null || input.getShipmentId().isEmpty()) {
            throw new IllegalArgumentException("Shipment ID cannot be null or empty");
        }
    }

    // Validate the input parameters for the GetLabelsInput.
    public static void validateGetLabelsInput(GetLabelsInput input) {

        if (input.getApiCredentials() == null) {
            throw new IllegalArgumentException("API credentials cannot be null");
        }
        if (input.getShipmentConfirmationId() == null || input.getShipmentConfirmationId().isEmpty()) {
            throw new IllegalArgumentException("Shipment Confirmation ID cannot be null or empty");
        }
        if (input.getPageType() == null || input.getPageType().isEmpty()) {
            throw new IllegalArgumentException("Page Type cannot be null or empty");
        }
        if (input.getPageSize() == null) {
            throw new IllegalArgumentException(("Page Size cannot be null or empty"));
        }
    }
}