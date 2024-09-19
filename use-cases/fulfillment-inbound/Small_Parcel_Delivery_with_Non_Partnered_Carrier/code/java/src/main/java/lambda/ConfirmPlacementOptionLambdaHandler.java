package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.ConfirmPlacementOptionResponse;
import lambda.utils.*;

/**
 * Confirming Placement Option for an inbound plan.
 */
public class ConfirmPlacementOptionLambdaHandler implements RequestHandler<ConfirmPlacementInput, ConfirmPlacementOptionResponse> {

    @Override
    public ConfirmPlacementOptionResponse handleRequest(ConfirmPlacementInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate Input
            ValidateInput.validateConfirmPlacementInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Call the Confirm Placement Option API
            ConfirmPlacementOptionResponse response = fbaInboundApi.confirmPlacementOption(input.getInboundPlanId(), input.getPlacementOptionId());
            // Log full response
            LambdaUtils.logResponse(context, response);
            // Return confirmation response
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context, e);
        }
    }
}
