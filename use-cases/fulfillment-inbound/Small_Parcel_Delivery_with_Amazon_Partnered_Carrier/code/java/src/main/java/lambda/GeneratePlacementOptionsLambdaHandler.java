package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.GeneratePlacementOptionsRequest;
import io.swagger.client.model.fbav2024.GeneratePlacementOptionsResponse;
import lambda.utils.*;

/**
 * Generating placement options for an inbound class.
 */
public class GeneratePlacementOptionsLambdaHandler implements RequestHandler<GeneratePlacementInput, GeneratePlacementOptionsResponse> {

    @Override
    public GeneratePlacementOptionsResponse handleRequest(GeneratePlacementInput input, Context context) {

        // Log Input.
        LambdaUtils.logInput(context, input);

        try {
            // Validate Input.
            ValidateInput.validateGeneratePlacementInput(input);
            // Get FBA Inbound API instance.
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundApiInstance(input);
            // Call Generate Placement Options API.
            GeneratePlacementOptionsRequest request = getGeneratePlacementRequestBody(input);
            GeneratePlacementOptionsResponse response = fbaInboundApi.generatePlacementOptions(input.getInboundPlanId(), request);
            // Log full response.
            LambdaUtils.logResponse(context, response);
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context.getLogger(), e);
        }
    }

    // Custom warehouses are valid only for India Marketplace for now !!
    public GeneratePlacementOptionsRequest getGeneratePlacementRequestBody(GeneratePlacementInput input) {
        // The Custom Placement Option is set to null since its available only in India Marketplace.
        return new GeneratePlacementOptionsRequest().customPlacement(null);
    }
}