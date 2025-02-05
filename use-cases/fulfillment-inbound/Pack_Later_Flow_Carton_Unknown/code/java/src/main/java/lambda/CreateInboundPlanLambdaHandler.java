package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.fbav2024.FbaInboundApi;
import io.swagger.client.model.fbav2024.CreateInboundPlanRequest;
import io.swagger.client.model.fbav2024.CreateInboundPlanResponse;
import io.swagger.client.model.fbav2024.ItemInput;
import io.swagger.client.model.fbav2024.LabelOwner;
import io.swagger.client.model.fbav2024.PrepOwner;
import lambda.utils.*;

import java.util.Collections;

/**
 * Creating an inbound plan using the FBA Inbound API v2024.
 */
public class CreateInboundPlanLambdaHandler implements RequestHandler<CreateInboundPlanInput, CreateInboundPlanResponse> {

    @Override
    public CreateInboundPlanResponse handleRequest(CreateInboundPlanInput input, Context context) {
        // Log input
        LambdaUtils.logInput(context, input);

        try {
            // Validate input
            ValidateInput.validateCreateInboundInput(input);
            // Get FBA Inbound API instance
            FbaInboundApi fbaInboundApi = ApiUtils.getFbaInboundv2024Api(input);
            // Create the request body for the Create Inbound Plan API
            CreateInboundPlanRequest request = getCreateInboundPlanRequestBody(input);
            // Call the Create Inbound Plan API
            CreateInboundPlanResponse response = fbaInboundApi.createInboundPlan(request);
            // Log full response
            LambdaUtils.logResponse(context, response);
            return response;

        } catch (Exception e) {
            // Handle any exceptions that occur during the execution of the function.
            LambdaUtils.logException(context, e);
            return ExceptionHandling.handleException(context, e);
        }
    }

    // Create Inbound Plan request body to handle a Single Box with 1 item.
    // Extend the code to handle multiple boxes and SKUs.
    private CreateInboundPlanRequest getCreateInboundPlanRequestBody(CreateInboundPlanInput input) {
        // Create a CreateInboundPlanRequest with the destination marketplace,
        // single item, source address, and inbound plan name.
        return new CreateInboundPlanRequest()
                .destinationMarketplaces(Collections.singletonList(input.getDestinationMarketplace()))
                .items(Collections.singletonList(new ItemInput()
                        .labelOwner(LabelOwner.valueOf(input.getLabelOwner()))
                        .prepOwner(PrepOwner.valueOf(input.getPrepOwner()))
                        .msku(input.getMsku())
                        .quantity(Constants.QUANTITY)))
                .sourceAddress(input.getSourceAddress())
                .name(input.getInboundPlanName());
    }
}

