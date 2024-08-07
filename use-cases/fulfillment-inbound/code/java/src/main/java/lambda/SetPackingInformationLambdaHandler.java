package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.*;
import lambda.utils.*;

import java.util.Collections;

/**
 * Setting the packing information for an inbound plan.
 */
public class SetPackingInformationLambdaHandler implements RequestHandler<SetPackingInput, SetPackingInformationResponse> {

    @Override
    public SetPackingInformationResponse handleRequest(SetPackingInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateSetPackingInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundApiInstance(input);
            // Create the request body for the Set Packing Information API
            SetPackingInformationRequest request = getSetPackingRequestBody(input);
            // Call the Set Packing Information API
            SetPackingInformationResponse response = fbaInboundApi.setPackingInformation(input.getInboundPlanId(), request);
            // Log full request
            LambdaUtils.logInput(context, request);
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context.getLogger(), e);
        }
    }

    // Set Packing Information request body. This code works for Single Box.
    // Extend the code to handle multiple boxes, Package Groups and SKUs.
    public SetPackingInformationRequest getSetPackingRequestBody(SetPackingInput input) {
        return new SetPackingInformationRequest()
                // Create a packingGroup input with the provided packing group ID
                .packageGroupings(Collections.singletonList(new PackageGroupingInput()
                        .packingGroupId(input.getPackingGroupId())
                        // Create a BoxInput with the provided dimensions, weight, and MSKU.
                        .boxes(Collections.singletonList(new BoxInput()
                                .contentInformationSource(BoxContentInformationSource.valueOf(Constants.CONTENT_INFORMATION_SOURCE))
                                .dimensions(input.getDimensions())
                                .items(Collections.singletonList(new ItemInput()
                                        .labelOwner(LabelOwner.valueOf(input.getLabelOwner()))
                                        .prepOwner(PrepOwner.valueOf(input.getPrepOwner()))
                                        .msku(input.getMsku()) // Same MSKU as provided in Create Inbound Plan
                                        .quantity(Constants.QUANTITY))) // Same Item Quantity as provided in Create Inbound Plan
                                .weight(input.getWeight())
                                .quantity(Constants.QUANTITY))))); // Box Quantity
    }
}

