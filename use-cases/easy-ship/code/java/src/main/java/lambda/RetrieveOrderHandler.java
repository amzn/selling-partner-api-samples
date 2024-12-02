package lambda;

import java.util.*;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.Context;
import com.google.gson.Gson;
import io.swagger.client.api.OrdersV0Api;
import io.swagger.client.model.orders.EasyShipShipmentStatus;
import io.swagger.client.model.orders.GetOrderItemsResponse;
import io.swagger.client.model.orders.GetOrderResponse;
import io.swagger.client.model.orders.OrderItem;
import lambda.utils.*;

import static lambda.utils.Constants.REFRESH_TOKEN_KEY_NAME;
import static lambda.utils.Constants.REGION_CODE_KEY_NAME;
import static org.apache.commons.lang3.ObjectUtils.isEmpty;

public class RetrieveOrderHandler implements RequestHandler<StateMachineInput, StateMachineInput> {

    @Override
    public StateMachineInput handleRequest(StateMachineInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("ProcessNotification Lambda input: " + new Gson().toJson(input));

        try {
            // Validate input
            ValidateInput.validateRetrieveOrderInput(input);
            // Get Order V0 API instance
            OrdersV0Api OrdersApi = ApiUtils.getOrdersV0Api(input);

            // API calls to retrieve order and order items
            GetOrderResponse orderResponse = OrdersApi.getOrder(input.getAmazonOrderId());
            logger.log("Order Response : " + new Gson().toJson(orderResponse));

            GetOrderItemsResponse orderItemsResponse = OrdersApi.getOrderItems(input.getAmazonOrderId(), null);
            logger.log("Order Items Response : " + new Gson().toJson(orderItemsResponse));

            if (!EasyShipShipmentStatus.PENDINGSCHEDULE.equals(orderResponse.getPayload().getEasyShipShipmentStatus())) {
                    throw new IllegalArgumentException(
                        String.format("Amazon Order Id : %s is not EasyShip order", input.getAmazonOrderId()));
            }
            EasyShipOrder easyShipOrder = new EasyShipOrder();
            easyShipOrder.setOrderItems(getOrderItemList(orderItemsResponse));
            input.setEasyShipOrder(easyShipOrder);

            return input;
        } catch (Exception e) {
            throw new RuntimeException("Calling Orders API failed", e);
        }
    }


    private List<EasyShipOrderItem> getOrderItemList(GetOrderItemsResponse orderItems) {
        List<EasyShipOrderItem> itemList = new ArrayList<>();

        for (OrderItem orderItem : orderItems.getPayload().getOrderItems()) {
            EasyShipOrderItem item = new EasyShipOrderItem();
            item.setOrderItemId(orderItem.getOrderItemId());
            item.setSku(orderItem.getSellerSKU());
            item.setQuantity(orderItem.getQuantityOrdered());
            // Some region will need SerialNumber
            if (!isEmpty(orderItem.isSerialNumberRequired()) && orderItem.isSerialNumberRequired()) {
                item.setOrderItemSerialNumbers(orderItem.getSerialNumbers());
            }
            itemList.add(item);
        }

        return itemList;
    }
}
