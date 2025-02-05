package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.DeliveryWindowOption;
import io.swagger.client.model.fbav2024.ListDeliveryWindowOptionsResponse;
import lambda.utils.enums.DeliveryWindowResponseKey;
import lambda.utils.*;

import java.util.*;

/**
 * Listing generated delivery window options for an inbound plan.
 * Selecting the delivery window option with the latest endDate.
 */
public class ListDeliveryWindowOptionsLambdaHandler implements RequestHandler<ListDeliveryWindowInput, Map<String, Object>> {

    @Override
    public Map<String, Object> handleRequest(ListDeliveryWindowInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateListDeliveryWindowInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);

            // Initialize the token and delivery window options list
            String nextToken = null;
            List<DeliveryWindowOption> allDeliveryWindowOptions = new ArrayList<>();

            do {
                // Call the List Delivery Window Options API
                ListDeliveryWindowOptionsResponse listResponse = fbaInboundApi.listDeliveryWindowOptions(input.getInboundPlanId(), input.getShipmentId(), Constants.PAGE_SIZE, nextToken);
                // Log full response
                LambdaUtils.logResponse(context, listResponse);

                // Extract data from the list response
                List<DeliveryWindowOption> deliveryWindowOptions = listResponse.getDeliveryWindowOptions();
                if (deliveryWindowOptions != null && !deliveryWindowOptions.isEmpty()) {
                    allDeliveryWindowOptions.addAll(deliveryWindowOptions);
                }

                // Get the nextToken for pagination
                nextToken = listResponse.getPagination() != null ? listResponse.getPagination().getNextToken() : null;

            } while (nextToken != null && !nextToken.isEmpty());

            // Create a map to hold the selected delivery window option
            Map<String, Object> response = new HashMap<>();

            // Check if there are any available delivery window options
            if (allDeliveryWindowOptions.isEmpty()) {
                // Log error if no delivery window options found
                LambdaUtils.logMessage(context, "No Delivery Window options found");
                response.put(DeliveryWindowResponseKey.ERROR.getKey(), "No Delivery Window options found");

            } else {
                // Search and choose the delivery window option with the latest endDate.
                // Modify the code to determine the best delivery window option for you.
                DeliveryWindowOption selectedOption = allDeliveryWindowOptions.get(0);
                // Update the selected option if a later endDate is found
                for (DeliveryWindowOption option : allDeliveryWindowOptions) {
                    if (option.getEndDate().isAfter(selectedOption.getEndDate())) {
                        selectedOption = option;
                    }
                }
                response.put(DeliveryWindowResponseKey.DELIVERY_WINDOW_OPTION_ID.getKey(), selectedOption.getDeliveryWindowOptionId());
            }
            // Return the delivery window options response or error
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context, e);
        }
    }
}