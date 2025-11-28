package easyship;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.orders.v0.OrdersV0Api;
import software.amazon.spapi.models.orders.v0.EasyShipShipmentStatus;
import software.amazon.spapi.models.orders.v0.GetOrderItemsResponse;
import software.amazon.spapi.models.orders.v0.GetOrderResponse;
import util.Recipe;
import util.Constants;

import com.amazon.SellingPartnerAPIAA.LWAException;

/**
 * Code Recipe to retrieve an EasyShip order using the Orders API
 * Steps:
 * 1. Setup order details
 * 2. Initialize Orders API client
 * 3. Get order details
 * 4. Get order items
 * 5. Validate EasyShip order status
 */
public class RetrieveOrderRecipe extends Recipe {

    private OrdersV0Api ordersApi;
    private String amazonOrderId;

    @Override
    protected void start() {
        setupOrderDetails();
        initializeOrdersApi();
        GetOrderResponse orderResponse = getOrder();
        GetOrderItemsResponse orderItemsResponse = getOrderItems();
        validateEasyShipOrder(orderResponse);
        System.out.println("✅ Successfully retrieved EasyShip order");
    }

    private void setupOrderDetails() {
        amazonOrderId = "702-3035602-4225066";
        System.out.println("Order details configured: " + amazonOrderId);
    }

    private void initializeOrdersApi() {
        ordersApi = new OrdersV0Api.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        System.out.println("Orders API client initialized");
    }

    private GetOrderResponse getOrder() {
        try {
            GetOrderResponse response = ordersApi.getOrder(amazonOrderId);
            System.out.println("Order retrieved: " + amazonOrderId);
            return response;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get order", e);
        }
    }

    private GetOrderItemsResponse getOrderItems() {
        try {
            GetOrderItemsResponse response = ordersApi.getOrderItems(amazonOrderId, null);
            System.out.println("Order items retrieved: " + response.getPayload().getOrderItems().size() + " items");
            return response;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get order items", e);
        }
    }

    private void validateEasyShipOrder(GetOrderResponse orderResponse) {
        if (!EasyShipShipmentStatus.PENDINGSCHEDULE.equals(orderResponse.getPayload().getEasyShipShipmentStatus())) {
            throw new IllegalArgumentException("Order is not an EasyShip order with PENDING_SCHEDULE status");
        }
        System.out.println("✅ Order validated as EasyShip order");
    }
}

    