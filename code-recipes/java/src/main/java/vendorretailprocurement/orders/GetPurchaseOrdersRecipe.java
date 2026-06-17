package vendorretailprocurement.orders;

import com.amazon.SellingPartnerAPIAA.LWAException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.orders.v1.VendorOrdersApi;
import software.amazon.spapi.models.vendor.orders.v1.GetPurchaseOrdersResponse;
import software.amazon.spapi.models.vendor.orders.v1.Order;
import util.Constants;
import util.Recipe;

import java.util.List;

/**
 * Vendor Orders API Recipe: Get Purchase Orders
 * ==============================================
 * 
 * This recipe demonstrates how to retrieve purchase orders from Amazon using the
 * Vendor Orders API. You can filter orders by creation date, change date, state,
 * and other criteria.
 * 
 * Use cases:
 * - Retrieve new purchase orders that need to be fulfilled
 * - Get orders that have been modified (changed quantities, cancelled items)
 * - Filter orders by state (New, Acknowledged, Closed)
 * 
 * API Operations used:
 * - getPurchaseOrders: Returns a list of purchase orders based on filters
 */
public class GetPurchaseOrdersRecipe extends Recipe {

    private static final Logger logger = LoggerFactory.getLogger(GetPurchaseOrdersRecipe.class);

    private final VendorOrdersApi vendorOrdersApi = new VendorOrdersApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    @Override
    public void start() {
        // Example 1: Get new purchase orders created in the last 7 days
        List<Order> newOrders = getPurchaseOrdersByDateRange(
                OffsetDateTime.now().minusDays(7),
                OffsetDateTime.now(),
                "New"
        );
        logger.info("Found {} new orders", newOrders.size());

        // Example 2: Get orders that have been changed/modified
        List<Order> changedOrders = getChangedPurchaseOrders(
                OffsetDateTime.now().minusDays(7),
                OffsetDateTime.now()
        );
        logger.info("Found {} changed orders", changedOrders.size());

        // Print order details
        for (Order order : newOrders) {
            logOrderSummary(order);
        }
    }

    /**
     * Get purchase orders created within a date range, filtered by state.
     */
    public List<Order> getPurchaseOrdersByDateRange(
            OffsetDateTime createdAfter,
            OffsetDateTime createdBefore,
            String orderState) {
        try {
            GetPurchaseOrdersResponse response = vendorOrdersApi.getPurchaseOrders(
                    100L, createdAfter, createdBefore, "DESC", null, "true",
                    null, null, null, null, orderState, null
            );
            if (response.getPayload() != null && response.getPayload().getOrders() != null) {
                return response.getPayload().getOrders();
            }
            return List.of();
        } catch (ApiException | LWAException e) {
            logger.error("Error getting purchase orders: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to get purchase orders", e);
        }
    }

    /**
     * Get purchase orders that have been changed/modified within a date range.
     */
    public List<Order> getChangedPurchaseOrders(
            OffsetDateTime changedAfter,
            OffsetDateTime changedBefore) {
        try {
            GetPurchaseOrdersResponse response = vendorOrdersApi.getPurchaseOrders(
                    100L, null, null, "DESC", null, "true",
                    changedAfter, changedBefore, null, "true", null, null
            );
            if (response.getPayload() != null && response.getPayload().getOrders() != null) {
                return response.getPayload().getOrders();
            }
            return List.of();
        } catch (ApiException | LWAException e) {
            logger.error("Error getting changed orders: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to get changed purchase orders", e);
        }
    }

    private void logOrderSummary(Order order) {
        logger.info("----------------------------------------");
        logger.info("PO Number: {}", order.getPurchaseOrderNumber());
        logger.info("State: {}", order.getPurchaseOrderState());
        if (order.getOrderDetails() != null) {
            logger.info("Order Date: {}", order.getOrderDetails().getPurchaseOrderDate());
            logger.info("Ship Window: {}", order.getOrderDetails().getShipWindow());
            if (order.getOrderDetails().getItems() != null) {
                logger.info("Items: {}", order.getOrderDetails().getItems().size());
            }
        }
    }
}
