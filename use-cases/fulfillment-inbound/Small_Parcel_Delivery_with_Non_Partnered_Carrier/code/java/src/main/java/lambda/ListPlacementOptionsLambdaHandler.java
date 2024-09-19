package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.Incentive;
import io.swagger.client.model.fbav2024.ListPlacementOptionsResponse;
import io.swagger.client.model.fbav2024.PlacementOption;
import lambda.utils.enums.PlacementResponseKey;
import lambda.utils.*;

import java.util.*;

/**
 * Listing generated placement options for an inbound plan and choosing the cheapest cost placement option.
 */
public class ListPlacementOptionsLambdaHandler implements RequestHandler<ListPlacementInput, Map<String, Object>> {

    @Override
    public Map<String, Object> handleRequest(ListPlacementInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateListPlacementInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Initialize the token and placement options list
            String nextToken = null;
            List<PlacementOption> allPlacementOptions = new ArrayList<>();

            do {
                // Call List Placement Options API
                ListPlacementOptionsResponse listResponse = fbaInboundApi.listPlacementOptions(input.getInboundPlanId(), Constants.PAGE_SIZE, nextToken);
                // Log full response
                LambdaUtils.logResponse(context, listResponse);

                // Extract placement options data from the list response
                List<PlacementOption> placementOptions = listResponse.getPlacementOptions();
                if (placementOptions != null && !placementOptions.isEmpty()) {
                    allPlacementOptions.addAll(placementOptions);
                }
                // Get the nextToken for pagination
                nextToken = listResponse.getPagination() != null ? listResponse.getPagination().getNextToken() : null;

            } while (nextToken != null && !nextToken.isEmpty());

            // Create a response map to include the cheapest placement option
            Map<String, Object> response = new HashMap<>();

            if (!allPlacementOptions.isEmpty()) {
                // Initialize variables for finding the cheapest placement option
                PlacementOption cheapestOption = null;
                double minFee = Double.MAX_VALUE;

                // Iterate through all placement options to find the cheapest one
                // Modify the code to determine the best placement option for you
                for (PlacementOption option : allPlacementOptions) {
                    double totalFee = calculateTotalFees(option); // Calculate the total fee for each option
                    if (totalFee < minFee) {
                        minFee = totalFee; // Update the minimum fee
                        cheapestOption = option; // Set the current option as the cheapest
                    }
                }

                // Add the cheapest placement option's ID and the corresponding shipment ID to the response map
                response.put(PlacementResponseKey.PLACEMENT_OPTION_ID.getKey(), cheapestOption.getPlacementOptionId());
                // Since the inbound plan contains only a single item, there will be only one shipment ID
                response.put(PlacementResponseKey.SHIPMENT_ID.getKey(), cheapestOption.getShipmentIds().get(0));

            } else {
                // Log error if no placement options found
                LambdaUtils.logMessage(context, "No placement options found in the response");
                response.put(PlacementResponseKey.ERROR.getKey(), "No placement options found");
            }

            // Return the placementOptionID and shipmentID or error message
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context, e);
        }
    }

    // Total Fee calculation method
    private double calculateTotalFees(PlacementOption option) {
        double totalFee = 0.0;
        String FEE_TYPE = "FEE"; // field for the fee type
        for (Incentive fee : option.getFees()) {
            // Use the defined FEE string for fee type comparison
            if (FEE_TYPE.equals(fee.getType()) && fee.getValue() != null && fee.getValue().getAmount() != null) {
                totalFee += fee.getValue().getAmount().doubleValue();  // Ensure proper conversion if necessary
            }
        }
        return totalFee;
    }
}