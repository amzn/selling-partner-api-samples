package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.InboundOperationStatus;
import lambda.utils.*;

/**
 * Retrieving the status of an inbound post operation.
 */
public class OperationStatusLambdaHandler implements RequestHandler<OperationStatusInput, InboundOperationStatus> {

    @Override
    public InboundOperationStatus handleRequest(OperationStatusInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateOperationStatusInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundApiInstance(input);
            // Call Operation Status API
            InboundOperationStatus response = fbaInboundApi.getInboundOperationStatus(input.getOperationId());
            // Log full response
            LambdaUtils.logResponse(context, response);
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context.getLogger(), e);
        }
    }
}