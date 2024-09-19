package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.*;
import lambda.utils.*;
import lambda.utils.enums.InboundPlanBoxesResponseKey;

import java.util.*;

/**
 * Fetching boxes information along with the boxIDs for an inbound plan.
 */
public class ListInboundPlanBoxesLambdaHandler implements RequestHandler<ListInboundPlanBoxesInput, Map<String, Object>> {

    @Override
    public Map<String, Object> handleRequest(ListInboundPlanBoxesInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateListInboundPlanBoxesInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Initialize the token and boxIds list
            String nextToken = null;
            List<String> boxIds = new ArrayList<>();

            do {
                ListInboundPlanBoxesResponse listResponse = fbaInboundApi.listInboundPlanBoxes(input.getInboundPlanId(), Constants.PAGE_SIZE, nextToken);
                // Log full response
                LambdaUtils.logResponse(context, listResponse);

                // Extract boxIds from the response
                if (listResponse.getBoxes() != null) {
                    for (Box box : listResponse.getBoxes()) {
                        boxIds.add(box.getBoxId());
                    }
                }

                // Update nextToken for the next iteration
                nextToken = listResponse.getPagination() != null ? listResponse.getPagination().getNextToken() : null;

            } while (nextToken != null && !nextToken.isEmpty());

            // Code handles only a Single Box, hence only one boxId will be present. Modify to handle multiple boxes.
            Map<String, Object> response = new HashMap<>();
            if (!boxIds.isEmpty()) {
                response.put(InboundPlanBoxesResponseKey.BOX_ID.getKey(), boxIds.get(0)); // Modify this to return multiple boxIds if needed
            } else {
                // Log error if no boxes found
                LambdaUtils.logMessage(context, "No boxes found");
                response.put(InboundPlanBoxesResponseKey.ERROR.getKey(), "No boxes found");
            }
            // Return the Box Id or error
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context, e);
        }
    }
}