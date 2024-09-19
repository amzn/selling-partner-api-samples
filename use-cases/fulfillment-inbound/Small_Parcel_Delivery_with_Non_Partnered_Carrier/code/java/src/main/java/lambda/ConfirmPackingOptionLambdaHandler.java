package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.ConfirmPackingOptionResponse;
import lambda.utils.*;

/**
 * Confirming Packing Option for an inbound plan. Only ONE packing option can be confirmed per inbound plan.
 */
public class ConfirmPackingOptionLambdaHandler implements RequestHandler<ConfirmPackingInput, ConfirmPackingOptionResponse> {

    @Override
    public ConfirmPackingOptionResponse handleRequest(ConfirmPackingInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateConfirmPackingInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Confirm the packing option
            ConfirmPackingOptionResponse response = fbaInboundApi.confirmPackingOption(input.getInboundPlanId(), input.getPackingOptionId());
            // Log full response
            LambdaUtils.logResponse(context, response);
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context, e);
        }
    }
}