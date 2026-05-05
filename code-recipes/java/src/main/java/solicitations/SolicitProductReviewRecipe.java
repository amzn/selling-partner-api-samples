package solicitations;

import com.fasterxml.jackson.jr.ob.JSON;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.orders.v0.OrdersV0Api;
import software.amazon.spapi.api.solicitations.v1.SolicitationsApi;
import software.amazon.spapi.models.orders.v0.GetOrderResponse;
import software.amazon.spapi.models.orders.v0.Order;
import software.amazon.spapi.models.solicitations.v1.CreateProductReviewAndSellerFeedbackSolicitationResponse;
import software.amazon.spapi.models.solicitations.v1.GetSolicitationActionsForOrderResponse;
import software.amazon.spapi.models.solicitations.v1.LinkObject;
import util.Recipe;
import util.Constants;

import com.amazon.SellingPartnerAPIAA.LWAException;
import java.io.File;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Code Recipe to solicit product reviews after order shipment
 * Steps:
 * 1. Parse ORDER_CHANGE notification
 * 2. Validate OrderStatus is Shipped
 * 3. Get order details and check delivery dates
 * 4. Store key identifiers
 * 5. Check if product review can be solicited
 * 6. Solicit product review
 * 
 * NOTE: If you don't have a notification subscription, please refer to the notifications code-recipes to learn how to create one.
 */

public class SolicitProductReviewRecipe extends Recipe {

    private OrdersV0Api ordersApi;
    private SolicitationsApi solicitationsApi;
    private String notificationFilePath;

    @Override
    protected void start() {
        notificationFilePath = "../test/resources/notifications/ORDER_CHANGE/shipped.json";
        java.util.Map<String, Object> notification = parseNotification();
        if (validateOrderStatus(notification)) {
            java.util.Map<String, Object> payload = (java.util.Map<String, Object>) notification.get("Payload");
            java.util.Map<String, Object> orderChange = (java.util.Map<String, Object>) payload.get("OrderChangeNotification");
            String amazonOrderId = (String) orderChange.get("AmazonOrderId");
            java.util.Map<String, Object> summary = (java.util.Map<String, Object>) orderChange.get("Summary");
            String marketplaceId = (String) summary.get("MarketplaceId");
            
            initializeOrdersApi();
            Order order = getOrderDetails(amazonOrderId);
            
            if (checkDeliveryDates(order)) {
                storeKeyIdentifiers(amazonOrderId, marketplaceId);
                initializeSolicitationsApi();
                if (canSolicitReview(amazonOrderId, List.of(marketplaceId))) {
                    solicitProductReview(amazonOrderId, List.of(marketplaceId));
                } else {
                    System.out.println("❌ Cannot solicit review for this order");
                }
            } else {
                System.out.println("❌ Order is outside the valid solicitation timeframe");
            }
        } else {
            System.out.println("❌ Order status is not Shipped");
        }
    }

    private java.util.Map<String, Object> parseNotification() {
        try {
            return JSON.std.mapFrom(new File(notificationFilePath));
        } catch (IOException e) {
            throw new RuntimeException("Failed to parse notification", e);
        }
    }

    private boolean validateOrderStatus(java.util.Map<String, Object> notification) {
        java.util.Map<String, Object> payload = (java.util.Map<String, Object>) notification.get("Payload");
        java.util.Map<String, Object> orderChange = (java.util.Map<String, Object>) payload.get("OrderChangeNotification");
        java.util.Map<String, Object> summary = (java.util.Map<String, Object>) orderChange.get("Summary");
        String orderStatus = (String) summary.get("OrderStatus");
        boolean isShipped = "Shipped".equals(orderStatus);
        System.out.println(isShipped ? "✅ Order status is Shipped" : "Order status: " + orderStatus);
        return isShipped;
    }

    private void initializeOrdersApi() {
        ordersApi = new OrdersV0Api.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        System.out.println("Orders API client initialized");
    }

    private Order getOrderDetails(String amazonOrderId) {
        try {
            GetOrderResponse response = ordersApi.getOrder(amazonOrderId);
            System.out.println("✅ Retrieved order details");
            return response.getPayload();
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get order details", e);
        }
    }

    private boolean checkDeliveryDates(Order order) {
        if (order.getEarliestDeliveryDate() == null || order.getLatestDeliveryDate() == null) {
            System.out.println("❌ Delivery dates not available");
            return false;
        }
        
        OffsetDateTime earliestDelivery = OffsetDateTime.parse(order.getEarliestDeliveryDate());
        OffsetDateTime latestDelivery = OffsetDateTime.parse(order.getLatestDeliveryDate());
        OffsetDateTime now = OffsetDateTime.now();
        
        OffsetDateTime validFrom = earliestDelivery.plusDays(5);
        OffsetDateTime validUntil = latestDelivery.plusDays(30);
        
        System.out.println("⏱️ Earliest delivery date: " + earliestDelivery);
        System.out.println("⏱️ Latest delivery date: " + latestDelivery);



        boolean isValid = now.isAfter(validFrom) && now.isBefore(validUntil);
        System.out.println(isValid ? "✅ Within valid solicitation timeframe" : "Outside valid timeframe");
        return isValid;
    }

    private void storeKeyIdentifiers(String amazonOrderId, String marketplaceId) {
        System.out.println("✅ Stored identifiers - OrderId: " + amazonOrderId + ", MarketplaceId: " + marketplaceId);
    }

    private void initializeSolicitationsApi() {
        solicitationsApi = new SolicitationsApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        System.out.println("Solicitations API client initialized");
    }

    private boolean canSolicitReview(String amazonOrderId, List<String> marketplaceIds) {
        try {
            GetSolicitationActionsForOrderResponse response = 
                solicitationsApi.getSolicitationActionsForOrder(amazonOrderId, marketplaceIds);
            for (LinkObject link : response.getLinks().getActions()) {
                if (link.getName().contains("productReviewAndSellerFeedback")) {
                    System.out.println("✅ Can solicit review for this order");
                    return true;
                }
            }
            return false;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get solicitation actions", e);
        }
    }

    private void solicitProductReview(String amazonOrderId, List<String> marketplaceIds) {
        try {
            CreateProductReviewAndSellerFeedbackSolicitationResponse response = 
                solicitationsApi.createProductReviewAndSellerFeedbackSolicitation(amazonOrderId, marketplaceIds);
            System.out.println("✅ Product review solicitation sent successfully");
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to solicit product review", e);
        }
    }
}
