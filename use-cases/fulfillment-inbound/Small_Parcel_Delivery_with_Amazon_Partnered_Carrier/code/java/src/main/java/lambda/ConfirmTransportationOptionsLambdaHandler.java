package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.ConfirmTransportationOptionsRequest;
import io.swagger.client.model.fbav2024.ConfirmTransportationOptionsResponse;
import io.swagger.client.model.fbav2024.TransportationSelection;
import lambda.utils.*;

import java.util.Collections;

/**
 * Confirming transportation option for an inbound plan.
 */
public class ConfirmTransportationOptionsLambdaHandler implements RequestHandler<ConfirmTransportInput, ConfirmTransportationOptionsResponse> {

    @Override
    public ConfirmTransportationOptionsResponse handleRequest(ConfirmTransportInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateConfirmTransportInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundApiInstance(input);
            // Create the request body for the Confirm Transportation Options API
            ConfirmTransportationOptionsRequest request = getConfirmTransportationRequestBody(input);
            // Call the Confirm Transportation Options API
            ConfirmTransportationOptionsResponse response = fbaInboundApi.confirmTransportationOptions(input.getInboundPlanId(), request);
            // Log full response
            LambdaUtils.logResponse(context, response);
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context.getLogger(), e);
        }
    }

    // Confirm Transportation Options Request Body
    public ConfirmTransportationOptionsRequest getConfirmTransportationRequestBody(ConfirmTransportInput input) {
        // Create a TransportationSelection object with the provided shipment ID and transportation option ID
        TransportationSelection transportationSelection = new TransportationSelection()
                .shipmentId(input.getShipmentId())
                .transportationOptionId(input.getTransportationOptionId());

        // Create the ConfirmTransportationOptionsRequest with the TransportationSelection
        return new ConfirmTransportationOptionsRequest()
                .transportationSelections(Collections.singletonList(transportationSelection));
    }
}
