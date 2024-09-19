package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav0.FbaInboundApi;
import io.swagger.client.model.fbav0.GetLabelsResponse;
import lambda.utils.*;

/**
 * Getting the Shipment Labels for an inbound plan.
 */
public class GetLabelsLambdaHandler implements RequestHandler<GetLabelsInput, String> {

    @Override
    public String handleRequest(GetLabelsInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateGetLabelsInput(input);
            // Get FBA Inbound v0 API instance
            FbaInboundApi fbaInboundApiv0 = ApiUtils.getFbaInboundV0Api(input);
            // Call the Get Labels API (v0) using the shipment confirmation ID, page type, label type, and page size
            GetLabelsResponse labelsResponse = fbaInboundApiv0.getLabels(
                    input.getShipmentConfirmationId(),
                    input.getPageType(),
                    input.getLabelType(),
                    null,
                    null,
                    null,
                    input.getPageSize(),
                    null
            );
            // Log full response
            LambdaUtils.logResponse(context, labelsResponse);

            // Fetch the label URL from the payload of the GetLabelsResponse
            String labelUrl = labelsResponse.getPayload().getDownloadURL();
            LambdaUtils.logMessage(context, "Label URL: " + labelUrl);
            return labelUrl;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context, e);
        }
    }
}
