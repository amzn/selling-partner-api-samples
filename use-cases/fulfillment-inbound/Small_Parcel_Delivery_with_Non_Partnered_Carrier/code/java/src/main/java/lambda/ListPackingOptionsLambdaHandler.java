package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.ListPackingOptionsResponse;
import io.swagger.client.model.fbav2024.PackingOption;
import lambda.utils.enums.PackingResponseKey;
import lambda.utils.*;

import java.util.*;

/**
 * Listing generated Packing Options for an inbound plan and choosing one of the packing option.
 * You can choose only ONE packing option per an inbound plan.
 */
public class ListPackingOptionsLambdaHandler implements RequestHandler<ListPackingInput, Map<String, Object>> {

    @Override
    public Map<String, Object> handleRequest(ListPackingInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateListPackingInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Initialize variables to store the packing group IDs and the next token
            String nextToken = null;
            List<String> packingGroupIds = new ArrayList<>();
            PackingOption selectedPackingOption = null;

            do {
                // List packing options
                ListPackingOptionsResponse listResponse = fbaInboundApi.listPackingOptions(input.getInboundPlanId(), Constants.PAGE_SIZE, nextToken);
                // Log full response
                LambdaUtils.logResponse(context, listResponse);
                // Extract packing options from the list response
                List<PackingOption> packingOptions = listResponse.getPackingOptions();

                if (packingOptions != null && !packingOptions.isEmpty()) {
                    // Iterate through all the packing options and select the first one.
                    // Modify the code to determine the best packing option for you.
                    selectedPackingOption = packingOptions.get(0);
                    packingGroupIds.addAll(selectedPackingOption.getPackingGroups());
                }

                // Update nextToken for the next iteration
                nextToken = listResponse.getPagination() != null ? listResponse.getPagination().getNextToken() : null;

            } while (nextToken != null && !nextToken.isEmpty());

            // Create a response map to include the packing option
            Map<String, Object> response = new HashMap<>();

            if (selectedPackingOption != null) {

                response.put(PackingResponseKey.PACKING_GROUP_ID.getKey(), packingGroupIds);
                response.put(PackingResponseKey.PACKING_OPTION_ID.getKey(), selectedPackingOption.getPackingOptionId());

            } else {
                LambdaUtils.logMessage(context, "No packing options found in the response");
                response.put(PackingResponseKey.ERROR.getKey(), "No packing options found");
            }

            // Return the packingGroupID and packingOptionID or error
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context, e);
        }
    }
}