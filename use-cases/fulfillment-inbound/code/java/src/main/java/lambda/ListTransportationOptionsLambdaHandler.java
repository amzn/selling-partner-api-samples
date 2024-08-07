package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.ListTransportationOptionsResponse;
import io.swagger.client.model.fbav2024.TransportationOption;
import lambda.utils.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Listing generated transportation options for an inbound plan.
 * Selecting the option with Amazon Preferred Carrier.
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
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundApiInstance(input);
            // Initialize the token and transportation options list
            String nextToken = null;
            List<TransportationOption> allTransportationOptions = new ArrayList<>();

            do {
                // Call the List Transportation Options API
                ListTransportationOptionsResponse listResponse = fbaInboundApi.listTransportationOptions(
                        input.getInboundPlanId(), null, nextToken, input.getPlacementOptionId(), null);
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

            // Search for a transportation option with the AMAZON_PARTNERED_CARRIER shipping solution
            TransportationOption selectedOption = null;
            if (!allTransportationOptions.isEmpty()) {
                for (TransportationOption option : allTransportationOptions) {
                    if ("AMAZON_PARTNERED_CARRIER".equals(option.getShippingSolution())) {
                        selectedOption = option;
                        break;
                    }
                }
            }

            // Create a map to hold the selected transportation option
            Map<String, Object> response = new HashMap<>();
            if (selectedOption != null) {
                response.put("transportationOptionId", selectedOption.getTransportationOptionId());
            } else {
                // // Log error if no transportation options found with AMAZON_PARTNERED_CARRIER
                LambdaUtils.logMessage(context, "No transportation options found with AMAZON_PARTNERED_CARRIER");
            }
            // Return the transportation options response
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context.getLogger(), e);
        }
    }
}
