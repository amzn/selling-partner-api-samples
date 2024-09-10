package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.FbaOutboundApi;
import io.swagger.client.model.fbao.GetFulfillmentOrderResponse;
import io.swagger.client.model.fbao.FulfillmentShipment;
import io.swagger.client.model.fbao.FulfillmentShipmentItem;
import lambda.utils.MCFTrackingDetailsLambdaInput;
import java.util.List;
import java.util.ArrayList;

import static lambda.utils.ApiUtils.getFbaOutboundApi;

public class GetOrderTrackingDetailsHandler implements RequestHandler<MCFTrackingDetailsLambdaInput, MCFTrackingDetailsLambdaInput> {

    public MCFTrackingDetailsLambdaInput handleRequest(MCFTrackingDetailsLambdaInput input, Context context) {
     LambdaLogger logger = context.getLogger();

        logger.log("GetOrder input: " + input.getSellerFulfillmentOrderId());

        GetFulfillmentOrderResponse getFulfillmentOrderResponse;
        try {
            FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken());
            
            getFulfillmentOrderResponse = fbaoApi.getFulfillmentOrder(input.getSellerFulfillmentOrderId());
            logger.log("getFulfillmentOrder call output: " + getFulfillmentOrderResponse);
        } catch (Exception e) {
            throw new InternalError("Calling FBAOutbound GetOrder failed", e);
        }

        List<Integer> packageNumbers = new ArrayList<>();
        List<FulfillmentShipment> fulfillmentShipments = getFulfillmentOrderResponse.getPayload().getFulfillmentShipments();

        //If the order contains shipments, extract and store the package number from each of them
        if (fulfillmentShipments != null) {
            for (FulfillmentShipment fulfillmentShipment: fulfillmentShipments) {
                for (FulfillmentShipmentItem fulfillmentShipmentItem: fulfillmentShipment.getFulfillmentShipmentItem()) {
                    packageNumbers.add(fulfillmentShipmentItem.getPackageNumber());
                }
            }
        }

        MCFTrackingDetailsLambdaInput output = new MCFTrackingDetailsLambdaInput();
        output.setRegionCode(input.getRegionCode());
        output.setRefreshToken(input.getRefreshToken());
        output.setSellerFulfillmentOrderId(input.getSellerFulfillmentOrderId());
        output.setPackageNumbers(packageNumbers);
        return output;
    }   
}