package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.api.OrdersV0Api;
import io.swagger.client.model.mfn.Address;
import io.swagger.client.model.orders.GetOrderItemsResponse;
import io.swagger.client.model.orders.GetOrderResponse;
import io.swagger.client.model.orders.OrderItem;
import lambda.utils.MfnLambdaInput;
import lambda.utils.MfnOrder;
import lambda.utils.MfnOrderItem;

import java.util.ArrayList;
import java.util.List;

import static lambda.utils.ApiUtils.getOrdersApi;
import static lambda.utils.Constants.SHIP_FROM_EMAIL_ENV_VARIABLE;

public class RetrieveOrderHandler implements RequestHandler<MfnLambdaInput, MfnOrder> {

    public MfnOrder handleRequest(MfnLambdaInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("RetrieveOrder Lambda input: " + new Gson().toJson(input));

        try {
            OrdersV0Api ordersApi = getOrdersApi(input.getRegionCode(), input.getRefreshToken());

            //Get order and order items
            GetOrderResponse order = ordersApi.getOrder(input.getOrderId());
            logger.log("Order: " + new Gson().toJson(order));
            GetOrderItemsResponse orderItems = ordersApi.getOrderItems(input.getOrderId(), null);

            MfnOrder mfnOrder = new MfnOrder();
            mfnOrder.setOrderItems(getOrderItemList(orderItems));
            mfnOrder.setShipFromAddress(mapAddress(order.getPayload().getDefaultShipFromLocationAddress()));

            return mfnOrder;
        } catch (Exception e) {
            throw new InternalError("Calling Orders API failed", e);
        }
    }

    private List<MfnOrderItem> getOrderItemList(GetOrderItemsResponse orderItems) {
        List<MfnOrderItem> itemList = new ArrayList<>();

        for (OrderItem orderItem : orderItems.getPayload().getOrderItems()) {
            MfnOrderItem item = new MfnOrderItem();
            item.setOrderItemId(orderItem.getOrderItemId());
            item.setSku(orderItem.getSellerSKU());
            item.setQuantity(orderItem.getQuantityOrdered());


            itemList.add(item);
        }

        return itemList;
    }

    private Address mapAddress(io.swagger.client.model.orders.Address orderAddress) {
        Address mfnAddress = new Address()
                .name(orderAddress.getName())
                .addressLine1(orderAddress.getAddressLine1())
                .city(orderAddress.getCity())
                .stateOrProvinceCode(orderAddress.getStateOrRegion())
                .postalCode(orderAddress.getPostalCode())
                .countryCode(orderAddress.getCountryCode())
                .phone(orderAddress.getPhone().replaceAll("[^0-9]", ""));

        //Set ship-from email with the value provided in app.config
        //Update this section to match your product's logic
        mfnAddress.setEmail(System.getenv(SHIP_FROM_EMAIL_ENV_VARIABLE));

        return mfnAddress;
    }
}
