package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.FbaOutboundApi;
import io.swagger.client.model.fbao.GetFulfillmentOrderResponse;
import lambda.utils.MCFCreateOrderLambdaInput;

import static lambda.utils.ApiUtils.getFbaOutboundApi;

public class GetOrderHandler implements RequestHandler<MCFCreateOrderLambdaInput, MCFCreateOrderLambdaInput> {

    public MCFCreateOrderLambdaInput handleRequest(MCFCreateOrderLambdaInput input, Context context) {
     LambdaLogger logger = context.getLogger();
        logger.log("GetOrder input: " + input.getCreateFulfillmentOrderNotification());
    
        try {
            FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken(), context);
            
            GetFulfillmentOrderResponse getFulfillmentOrderResponse = fbaoApi.getFulfillmentOrder(input.getCreateFulfillmentOrderNotification().getSellerFulfillmentOrderId());
            logger.log("GetFulfillmentOrder call output: " + getFulfillmentOrderResponse);
        } catch (Exception e) {
            throw new InternalError("Calling FBAOutbound GetOrder failed", e);
        }

        return input;
    }
}