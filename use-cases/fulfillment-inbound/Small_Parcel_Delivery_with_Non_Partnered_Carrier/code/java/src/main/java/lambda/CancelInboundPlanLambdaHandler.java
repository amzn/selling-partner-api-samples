package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.CancelInboundPlanResponse;
import lambda.utils.*;

/**
 * Cancelling the inbound plan.
 */
public class CancelInboundPlanLambdaHandler implements RequestHandler<CancelInboundInput, Object> {

    @Override
    public Object handleRequest(CancelInboundInput input, Context context) {

        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateCancelInboundInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Call Cancel Inbound Plan API
            CancelInboundPlanResponse response = fbaInboundApi.cancelInboundPlan(input.getInboundPlanId());
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