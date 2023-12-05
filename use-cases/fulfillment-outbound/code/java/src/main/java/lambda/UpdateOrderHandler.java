package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.FbaOutboundApi;
import io.swagger.client.model.fbao.FulfillmentAction;
import io.swagger.client.model.fbao.UpdateFulfillmentOrderRequest;
import io.swagger.client.model.fbao.UpdateFulfillmentOrderResponse;
import lambda.utils.CreateFulfillmentOrderNotification;
import lambda.utils.MCFCreateOrderLambdaInput;

import static lambda.utils.ApiUtils.getFbaOutboundApi;

public class UpdateOrderHandler implements RequestHandler<MCFCreateOrderLambdaInput, MCFCreateOrderLambdaInput> {

    public MCFCreateOrderLambdaInput handleRequest(MCFCreateOrderLambdaInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("UpdateOrder input: " + input.getCreateFulfillmentOrderNotification());
    
        try {
            FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken(), context);
            UpdateFulfillmentOrderRequest updateFulfillmentOrderRequest = buildUpdateFulfillmentOrderRequest(input.getCreateFulfillmentOrderNotification());

            UpdateFulfillmentOrderResponse updateFulfillmentOrderResponse = fbaoApi.updateFulfillmentOrder(updateFulfillmentOrderRequest, input.getCreateFulfillmentOrderNotification().getSellerFulfillmentOrderId());
            logger.log("UpdateFulfillmentOrder call output: " + updateFulfillmentOrderResponse);
        } catch (Exception e) {
            throw new InternalError("Calling FBAOutbound UpdateOrder failed", e);
        }

        return input;
    }

    UpdateFulfillmentOrderRequest buildUpdateFulfillmentOrderRequest(CreateFulfillmentOrderNotification createFulfillmentOrderNotification) {
        return new UpdateFulfillmentOrderRequest()
        .fulfillmentAction(FulfillmentAction.SHIP);
    }
}