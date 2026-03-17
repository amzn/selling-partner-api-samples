package vendorretailprocurement.orders;

import com.amazon.SellingPartnerAPIAA.LWAException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.orders.v1.VendorOrdersApi;
import software.amazon.spapi.models.vendor.orders.v1.GetPurchaseOrdersStatusResponse;
import software.amazon.spapi.models.vendor.orders.v1.OrderStatus;
import util.Constants;
import util.Recipe;

import java.util.List;

/**
 * Vendor Orders API Recipe: Get Purchase Orders Status
 * =====================================================
 * 
 * This recipe demonstrates how to retrieve purchase order statuses using the
 * Vendor Orders API. You can query by date range, specific PO number, or status.
 * 
 * Use cases:
 * - Check the current status of purchase orders (OPEN/CLOSED)
 * - Monitor order fulfillment progress
 * - Get item-level acknowledgement and receiving status
 * 
 * API Operations used:
 * - getPurchaseOrdersStatus: Returns purchase order statuses based on filters
 */
public class GetPurchaseOrdersStatusRecipe extends Recipe {

    private static final Logger logger = LoggerFactory.getLogger(GetPurchaseOrdersStatusRecipe.class);

    private final VendorOrdersApi vendorOrdersApi = new VendorOrdersApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    @Override
    public void start() {
        List<OrderStatus> statuses = getOrderStatusByDateRange(
                OffsetDateTime.now().minusDays(7),
                OffsetDateTime.now()
        );
        logger.info("Found {} order statuses", statuses.size());

        OrderStatus singleStatus = getOrderStatusByPONumber("2JK3S9VC");
        if (singleStatus != null) {
            logOrderStatus(singleStatus);
        }
    }

    /**
     * Get purchase order statuses within a date range.
     */
    public List<OrderStatus> getOrderStatusByDateRange(
            OffsetDateTime updatedAfter,
            OffsetDateTime updatedBefore) {
        try {
            GetPurchaseOrdersStatusResponse response = vendorOrdersApi.getPurchaseOrdersStatus(
                    100L, "DESC", null, null, null, updatedAfter, updatedBefore,
                    null, null, null, null, null, null
            );
            if (response.getPayload() != null && response.getPayload().getOrdersStatus() != null) {
                return response.getPayload().getOrdersStatus();
            }
            return List.of();
        } catch (ApiException | LWAException e) {
            logger.error("Error getting order statuses: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to get purchase order statuses", e);
        }
    }

    /**
     * Get status of a specific purchase order by PO number.
     */
    public OrderStatus getOrderStatusByPONumber(String purchaseOrderNumber) {
        try {
            GetPurchaseOrdersStatusResponse response = vendorOrdersApi.getPurchaseOrdersStatus(
                    1L, null, null, null, null, null, null,
                    purchaseOrderNumber, null, null, null, null, null
            );
            if (response.getPayload() != null && response.getPayload().getOrdersStatus() != null
                    && !response.getPayload().getOrdersStatus().isEmpty()) {
                logger.info("Found status for PO: {}", purchaseOrderNumber);
                return response.getPayload().getOrdersStatus().get(0);
            }
            logger.warn("No status found for PO: {}", purchaseOrderNumber);
            return null;
        } catch (ApiException | LWAException e) {
            logger.error("Error getting order status for {}: {}", purchaseOrderNumber, e.getMessage(), e);
            throw new RuntimeException("Failed to get purchase order status", e);
        }
    }

    private void logOrderStatus(OrderStatus status) {
        logger.info("========================================");
        logger.info("Purchase Order Status");
        logger.info("========================================");
        logger.info("PO Number: {}", status.getPurchaseOrderNumber());
        logger.info("PO Status: {}", status.getPurchaseOrderStatus());
        if (status.getItemStatus() != null) {
            logger.info("Item Statuses: {} items", status.getItemStatus().size());
            for (var item : status.getItemStatus()) {
                logger.info("  - Seq: {} | ASIN: {}",
                        item.getItemSequenceNumber(),
                        item.getBuyerProductIdentifier());
            }
        }
    }
}
