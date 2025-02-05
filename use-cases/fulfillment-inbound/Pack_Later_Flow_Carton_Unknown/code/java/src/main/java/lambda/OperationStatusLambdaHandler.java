package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.InboundOperationStatus;
import lambda.utils.*;

import java.util.*;

/**
 * Retrieving the status of an inbound (async) operation.
 */
public class OperationStatusLambdaHandler implements RequestHandler<OperationStatusInput, Map<String, Object>> {

    @Override
    public Map<String, Object> handleRequest(OperationStatusInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateOperationStatusInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Call Operation Status API
            InboundOperationStatus operationStatusResponse = fbaInboundApi.getInboundOperationStatus(input.getOperationId());
            // Log full response
            LambdaUtils.logResponse(context, operationStatusResponse);

            // Create a map to hold the operation status and problems response
            Map<String, Object> response = new HashMap<>();
            response.put("operationStatus", operationStatusResponse.getOperationStatus());

            // Serialize operationProblems to a JSON string
            ObjectMapper objectMapper = new ObjectMapper();
            String operationProblemsJson = objectMapper.writeValueAsString(operationStatusResponse.getOperationProblems());
            response.put("operationProblems", operationProblemsJson);

            // Return the constructed response map
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context, e);
        }
    }
}