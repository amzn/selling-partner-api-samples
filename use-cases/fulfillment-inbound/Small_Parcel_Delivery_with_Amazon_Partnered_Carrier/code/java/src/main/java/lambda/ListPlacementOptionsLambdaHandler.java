package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.Incentive;
import io.swagger.client.model.fbav2024.ListPlacementOptionsResponse;
import io.swagger.client.model.fbav2024.PlacementOption;
import lambda.utils.*;
import lambda.utils.enums.PlacementResponseKey;

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
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundApiInstance(input);
            // Initialize the token and placement options list
            String nextToken = null;
            List<PlacementOption> allPlacementOptions = new ArrayList<>();

            do {
                // Call List Placement Options API
                ListPlacementOptionsResponse listResponse = fbaInboundApi.listPlacementOptions(input.getInboundPlanId(), null, nextToken);
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

            if (!allPlacementOptions.isEmpty()) {
                // Find the cheapest Placement Option.
                PlacementOption cheapestOption = null;
                double minFee = Double.MAX_VALUE;
                for (PlacementOption option : allPlacementOptions) {
                    double totalFee = calculateTotalFees(option);
                    if (totalFee < minFee) {
                        minFee = totalFee;
                        cheapestOption = option;
                    }
                }

                if (cheapestOption != null) {
                    // Create a response map to include the cheapest placement option.
                    // Modify the code to determine the best placement option for you.
                    Map<String, Object> response = new HashMap<>();
                    response.put(PlacementResponseKey.PLACEMENT_OPTION_ID.getKey(), cheapestOption.getPlacementOptionId());
                    response.put(PlacementResponseKey.SHIPMENT_ID.getKey(), cheapestOption.getShipmentIds().get(0));
                    return response;
                }
            } else {
                // Log error if no placement options found.
                LambdaUtils.logMessage(context, "No placement options found in the response");
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put(PlacementResponseKey.ERROR.getKey(), "No placement options found");
                return errorResponse;
            }

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context.getLogger(), e);
        }
        return Collections.emptyMap();
    }

    // Total Fee calculation method
    private double calculateTotalFees(PlacementOption option) {
        double totalFee = 0.0;
        for (Incentive fee : option.getFees()) {
            if ("FEE".equals(fee.getType()) && fee.getValue() != null && fee.getValue().getAmount() != null) {
                totalFee += fee.getValue().getAmount().doubleValue();  // Ensure proper conversion if necessary
            }
        }
        return totalFee;
    }
}