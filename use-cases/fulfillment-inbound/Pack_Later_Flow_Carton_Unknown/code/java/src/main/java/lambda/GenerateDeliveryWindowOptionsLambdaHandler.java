package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.GenerateDeliveryWindowOptionsResponse;
import lambda.utils.*;

/**
 * Generating Delivery Window Options for an inbound option.
 */
public class GenerateDeliveryWindowOptionsLambdaHandler implements RequestHandler<GenerateDeliveryWindowInput, GenerateDeliveryWindowOptionsResponse> {

    @Override
    public GenerateDeliveryWindowOptionsResponse handleRequest(GenerateDeliveryWindowInput input, Context context) {

        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate Input
            ValidateInput.validateGenerateDeliveryWindowInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Call Generate Delivery Window Options API
            GenerateDeliveryWindowOptionsResponse response = fbaInboundApi.generateDeliveryWindowOptions(input.getInboundPlanId(), input.getShipmentId());
            // Log full response
            LambdaUtils.logResponse(context, response);
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context, e);
        }
    }
}