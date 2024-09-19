package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.GeneratePackingOptionsResponse;
import lambda.utils.*;

/**
 * Generating Packing Options for an inbound option.
 */
public class GeneratePackingOptionsLambdaHandler implements RequestHandler<ConfirmDeliveryWindowInput, GeneratePackingOptionsResponse> {

    @Override
    public GeneratePackingOptionsResponse handleRequest(ConfirmDeliveryWindowInput input, Context context) {

        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate Input
            ValidateInput.validateGeneratePackingInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Call Generate Packing Options API
            GeneratePackingOptionsResponse response = fbaInboundApi.generatePackingOptions(input.getInboundPlanId());
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