package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.api.EasyShipApi;
import io.swagger.client.model.easyship.ModelPackage;
import lambda.utils.ApiUtils;
import lambda.utils.StateMachineInput;


public class GetScheduledPackageHandler implements RequestHandler<StateMachineInput, StateMachineInput> {

    public StateMachineInput handleRequest(StateMachineInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("getScheduledPackage Lambda input: " + new Gson().toJson(input));

        try {
            EasyShipApi easyShipApi = ApiUtils.getEasyShipApi(input);
            ModelPackage response = easyShipApi.getScheduledPackage(input.getAmazonOrderId(), input.getMarketplaceId());
            logger.log("EasyShip API -  CreateScheduledPackage response: " + new Gson().toJson(response));
            // Validate if scheduled correctly using ScheduledPackageId
            if (!response.getScheduledPackageId().equals(input.getScheduledPackageId())) {
                throw new IllegalArgumentException(
                        String.format("Amazon Order Id : %s was not scheduled correctly", input.getAmazonOrderId()));
            }
            return input;
        } catch (Exception e) {
            throw new InternalError("Calling EasyShip API failed", e);
        }
    }
}
