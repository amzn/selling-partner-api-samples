package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.ListTransportationOptionsResponse;
import io.swagger.client.model.fbav2024.TransportationOption;
import lambda.utils.*;
import lambda.utils.enums.TransportationResponseKey;

import java.util.*;

/**
 * Listing generated transportation options for an inbound plan.
 * Selecting the option with Non-Amazon Partnered Carrier (Your own transportation carrier) and Pallet (Freight LTL).
 */
public class ListTransportationOptionsLambdaHandler implements RequestHandler<ListTransportationInput, Map<String, Object>> {

    @Override
    public Map<String, Object> handleRequest(ListTransportationInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate Input
            ValidateInput.validateListTransportationInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Initialize the token and transportation options list
            String nextToken = null;
            List<TransportationOption> allTransportationOptions = new ArrayList<>();

            do {
                // Call the List Transportation Options API
                ListTransportationOptionsResponse listResponse = fbaInboundApi.listTransportationOptions(
                        input.getInboundPlanId(), Constants.PAGE_SIZE, nextToken, input.getPlacementOptionId(), null);
                // Log full response
                LambdaUtils.logResponse(context, listResponse);

                // Extract data from the list response
                List<TransportationOption> transportationOptions = listResponse.getTransportationOptions();
                if (transportationOptions != null && !transportationOptions.isEmpty()) {
                    allTransportationOptions.addAll(transportationOptions);
                }
                // Get the nextToken for pagination
                nextToken = listResponse.getPagination() != null ? listResponse.getPagination().getNextToken() : null;

            } while (nextToken != null && !nextToken.isEmpty());

            // Create a map to hold the selected transportation option
            Map<String, Object> response = new HashMap<>();
            TransportationOption selectedOption = null;

            // Check if there are any available transportation options
            if (!allTransportationOptions.isEmpty()) {
                // Search for the first transportation option with the USE_YOUR_OWN_CARRIER shipping solution and FREIGHT_LTL shipping mode
                // Modify the code to determine the best your own carrier transportation option for you.
                for (TransportationOption option : allTransportationOptions) {
                    if ("USE_YOUR_OWN_CARRIER".equals(option.getShippingSolution()) &&
                            "FREIGHT_LTL".equals(option.getShippingMode())) {
                        selectedOption = option;
                        break; // Exit the loop as soon as the first matching option is found.
                    }
                }
            }

            // Check if an Amazon Partnered Carrier transportation option is found
            if (selectedOption != null) {
                response.put(TransportationResponseKey.TRANSPORTATION_OPTION_ID.getKey(), selectedOption.getTransportationOptionId());

            } else {
                // Log error if no transportation options found with set conditions
                LambdaUtils.logMessage(context, "No transportation options found with USE_YOUR_OWN_CARRIER & FREIGHT_LTL");
                response.put(TransportationResponseKey.ERROR.getKey(), "No transportation options found with USE_YOUR_OWN_CARRIER & FREIGHT_LTL");
            }
            // Return the transportation options response or error
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context, e);
        }
    }
}