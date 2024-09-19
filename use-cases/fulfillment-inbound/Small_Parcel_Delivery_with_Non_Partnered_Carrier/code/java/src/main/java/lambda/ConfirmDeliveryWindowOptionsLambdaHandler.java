package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.ConfirmDeliveryWindowOptionsResponse;
import lambda.utils.*;

/**
 * Confirming Delivery Window Option for an inbound plan.
 */
public class ConfirmDeliveryWindowOptionsLambdaHandler implements RequestHandler<ConfirmDeliveryWindowInput, ConfirmDeliveryWindowOptionsResponse> {

    @Override
    public ConfirmDeliveryWindowOptionsResponse handleRequest(ConfirmDeliveryWindowInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateConfirmDeliveryWindowInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Confirm the delivery window option
            ConfirmDeliveryWindowOptionsResponse response = fbaInboundApi.confirmDeliveryWindowOptions(input.getInboundPlanId(), input.getShipmentId(), input.getDeliveryWindowOptionId());
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