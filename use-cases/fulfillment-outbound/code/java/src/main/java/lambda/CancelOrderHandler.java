package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import lambda.utils.MCFCancelOrderLambdaInput;
import io.swagger.client.api.FbaOutboundApi;
import io.swagger.client.model.fbao.CancelFulfillmentOrderResponse;

import static lambda.utils.ApiUtils.getFbaOutboundApi;

public class CancelOrderHandler implements RequestHandler<MCFCancelOrderLambdaInput, MCFCancelOrderLambdaInput> {

    public MCFCancelOrderLambdaInput handleRequest(MCFCancelOrderLambdaInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("CancelOrder input: " + input.getCancelFulfillmentOrderNotification());

        try {
            FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken());

            CancelFulfillmentOrderResponse cancelFulfillmentOrderResponse = fbaoApi.cancelFulfillmentOrder(input.getCancelFulfillmentOrderNotification().getSellerFulfillmentOrderId());
            logger.log("CancelFulfillmentOrder call output: " + cancelFulfillmentOrderResponse);
        } catch (Exception e) {
            throw new InternalError("Calling FBAOutbound CancelOrder failed", e);
        }

        return input;
    }
}