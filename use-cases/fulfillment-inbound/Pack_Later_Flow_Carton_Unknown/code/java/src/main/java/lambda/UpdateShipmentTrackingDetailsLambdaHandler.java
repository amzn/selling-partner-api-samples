package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.*;
import lambda.utils.*;

import java.util.Collections;

/**
 * Updating Shipment Tracking Details for a pallet (LTL/FTL) delivery inbound shipment.
 */
public class UpdateShipmentTrackingDetailsLambdaHandler implements RequestHandler<UpdateShipmentTrackingInput, UpdateShipmentTrackingDetailsResponse> {

    @Override
    public UpdateShipmentTrackingDetailsResponse handleRequest(UpdateShipmentTrackingInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateUpdateShipmentTrackingInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Create the request body for Update Shipment Tracking Details Inbound Plan API
            UpdateShipmentTrackingDetailsRequest request = getUpdateShipmentTrackingRequestBody(input);
            // Call Update Shipment Tracking Details API
            UpdateShipmentTrackingDetailsResponse response = fbaInboundApi.updateShipmentTrackingDetails(input.getInboundPlanId(), input.getShipmentId(), request);
            // Log full response
            LambdaUtils.logResponse(context, response);
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context, e);
        }
    }

    // Update Shipment Tracking Details Request Body. Input the freight bill number from your carrier.
    // Code works for a freight bill number tracking update. Extend the code to handle multiple bills.
    public UpdateShipmentTrackingDetailsRequest getUpdateShipmentTrackingRequestBody(UpdateShipmentTrackingInput input) {
        return new UpdateShipmentTrackingDetailsRequest()
                .trackingDetails(new TrackingDetailsInput()
                        .ltlTrackingDetail(new LtlTrackingDetailInput()
                                .freightBillNumber(Collections.singletonList(input.getFreightBillNumber()))));
    }
}