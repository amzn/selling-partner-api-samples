package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.Shipment;
import lambda.utils.*;

/**
 * Retrieving shipment details for an inbound plan.
 */
public class GetShipmentLambdaHandler implements RequestHandler<GetShipmentInput, Shipment> {

    @Override
    public Shipment handleRequest(GetShipmentInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateGetShipmentInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundApiInstance(input);
            // Call Shipment Operation API to retrieve shipment details
            Shipment shipmentResponse = fbaInboundApi.getShipment(input.getInboundPlanId(), input.getShipmentId());
            // Log full response
            LambdaUtils.logResponse(context, shipmentResponse);
            return shipmentResponse;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context.getLogger(), e);
        }
    }
}
