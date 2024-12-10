package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.google.gson.Gson;
import io.swagger.client.api.EasyShipApi;
import io.swagger.client.model.easyship.ListHandoverSlotsResponse;
import io.swagger.client.model.easyship.ListHandoverSlotsRequest;
import lambda.utils.ApiUtils;
import lambda.utils.StateMachineInput;

public class ListHandoverSlotsHandler implements RequestHandler<StateMachineInput, StateMachineInput> {

    public StateMachineInput handleRequest(StateMachineInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("ListHandoverSlots Lambda input: " + new Gson().toJson(input));

        try {
            //Get list of handover shipment slot for the order
            ListHandoverSlotsRequest request = new ListHandoverSlotsRequest()
                    .amazonOrderId(input.getAmazonOrderId())
                    .marketplaceId(input.getMarketplaceId())
                    .packageDimensions(input.getEasyShipOrder().getPackageDimensions())
                    .packageWeight(input.getEasyShipOrder().getPackageWeight());

            logger.log("EasyShip API -  listHandoverSlots request: " + new Gson().toJson(request));

            EasyShipApi easyShipApi = ApiUtils.getEasyShipApi(input);
            ListHandoverSlotsResponse response = easyShipApi.listHandoverSlots(request);

            input.setTimeSlots((response.getTimeSlots()));
            return input;
        } catch (JsonProcessingException e) {
            throw new InternalError("Message body could not be mapped to EasyShipOrder", e);
        } catch (Exception e) {
            throw new InternalError("Calling EasyShip API failed", e);
        }
    }
}
