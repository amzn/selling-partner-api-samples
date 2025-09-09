package orders;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.*;
import software.amazon.spapi.api.orders.v0.OrdersV0Api;
import software.amazon.spapi.models.orders.v0.GetOrdersResponse;
import software.amazon.spapi.models.orders.v0.Order;
import util.Recipe;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;

import com.amazon.SellingPartnerAPIAA.LWAException;

/**
 * Code Recipe to retrieve orders from the last 30 days
 * Steps:
 * 1. Initialize Orders API client
 * 2. Calculate date range for last 30 days
 * 3. Retrieve orders from SP-API
 * 4. Display order information
 */
public class GetRecentOrders extends Recipe {

    private OrdersV0Api ordersApi;
    private String createdAfter;
    private String createdBefore;
    private List<String> marketplaceIds;
    private GetOrdersResponse ordersResponse;

    @Override
    protected void start() {
        initializeOrdersApi();
        calculateDateRange();
        retrieveOrders();
        displayResults();
    }

    /**
     * Step 1: Initialize the Orders API client with fresh credentials
     */
    private void initializeOrdersApi() {
        ordersApi = new OrdersV0Api.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint("https://sellingpartnerapi-na.amazon.com")
            .disableAccessTokenCache()
            .build();
        
        marketplaceIds = Arrays.asList("A2Q3Y263D00KWC");
        System.out.println("Orders API client initialized");
    }

    /**
     * Step 2: Calculate the date range for the last 30 days
     */
    private void calculateDateRange() {
        OffsetDateTime endDate = OffsetDateTime.now().minusMinutes(10);
        OffsetDateTime startDate = endDate.minusDays(30);
        
        createdAfter = startDate.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        createdBefore = endDate.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        
        System.out.println("Date range calculated: " + createdAfter + " to " + createdBefore);
    }

    /**
     * Step 3: Retrieve orders from the SP-API
     */
    private void retrieveOrders() {
        try {
            ordersResponse = ordersApi.getOrders(
                marketplaceIds,
                createdAfter,
                createdBefore,
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
            );
            System.out.println("Orders retrieved successfully");
        } catch (ApiException e) {
            System.out.println("API Error: " + e.getCode());
            System.out.println("Response: " + e.getResponseBody());
            throw new RuntimeException("Failed to retrieve orders", e);
        } catch (LWAException e) {
            throw new RuntimeException("Failed to retrieve orders", e);
        }
    }

    /**
     * Step 4: Display the retrieved order information
     */
    private void displayResults() {
        if (ordersResponse.getPayload() != null && ordersResponse.getPayload().getOrders() != null) {
            List<Order> orders = ordersResponse.getPayload().getOrders();
            System.out.println("Found " + orders.size() + " orders:");
            
            for (Order order : orders) {
                System.out.println("Order ID: " + order.getAmazonOrderId());
                System.out.println("  Status: " + order.getOrderStatus());
                System.out.println("  Total: " + order.getOrderTotal());
                System.out.println("  Purchase Date: " + order.getPurchaseDate());
                System.out.println("  Items: " + order.getNumberOfItemsShipped() + " shipped, " + 
                                 order.getNumberOfItemsUnshipped() + " unshipped");
                System.out.println();
            }
        } else {
            System.out.println("No orders found in the last 30 days.");
        }
    }
}