package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.google.gson.Gson;
import io.swagger.client.api.EasyShipApi;
import io.swagger.client.model.easyship.Item;
import io.swagger.client.model.easyship.Items;
import io.swagger.client.model.easyship.ModelPackage;
import io.swagger.client.model.easyship.OrderItemSerialNumbers;
import io.swagger.client.model.easyship.CreateScheduledPackageRequest;
import io.swagger.client.model.easyship.PackageDetails;
import lambda.utils.ApiUtils;
import lambda.utils.EasyShipOrderItem;
import lambda.utils.StateMachineInput;

public class CreateScheduledPackageHandler implements RequestHandler<StateMachineInput, StateMachineInput> {

    public StateMachineInput handleRequest(StateMachineInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("CreateScheduledPackage Lambda input: " + new Gson().toJson(input));

        try {
            Items items = new Items();
            for (EasyShipOrderItem orderItem : input.getEasyShipOrder().getOrderItems()) {
                logger.log("EasyShipOrderItem : " + new Gson().toJson(orderItem));
                Item item = new Item();
                item.setOrderItemId(orderItem.getOrderItemId());
                // Set the SerialNumber if it exists, as some region requires this value.
                if (orderItem.getOrderItemSerialNumbers() != null && !orderItem.getOrderItemSerialNumbers().isEmpty()) {
                    item.setOrderItemSerialNumbers((OrderItemSerialNumbers) orderItem.getOrderItemSerialNumbers());
                }
                items.add(item);
            }
            //Get list of handover shipment slot for the order
            CreateScheduledPackageRequest request = new CreateScheduledPackageRequest()
                    .amazonOrderId(input.getAmazonOrderId())
                    .marketplaceId(input.getMarketplaceId())
                    .packageDetails(new PackageDetails()
                            .packageTimeSlot(input.getTimeSlots().get(0)));

            logger.log("EasyShip API -  CreateScheduledPackage request: " + new Gson().toJson(request));

            EasyShipApi easyShipApi = ApiUtils.getEasyShipApi(input);
            ModelPackage response = easyShipApi.createScheduledPackage(request);
            logger.log("EasyShip API -  CreateScheduledPackage response: " + new Gson().toJson(response));
            // Store ScheduledPackageId to validate scheduled correctly using this information on the next step
            input.setScheduledPackageId(response.getScheduledPackageId());
            return input;
        } catch (JsonProcessingException e) {
            throw new InternalError("Message body could not be mapped to EasyShipOrder", e);
        } catch (Exception e) {
            throw new InternalError("Calling EasyShip API failed", e);
        }
    }
}
