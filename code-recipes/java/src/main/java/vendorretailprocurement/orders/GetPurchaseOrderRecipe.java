package vendorretailprocurement.orders;

import com.amazon.SellingPartnerAPIAA.LWAException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.orders.v1.VendorOrdersApi;
import software.amazon.spapi.models.vendor.orders.v1.GetPurchaseOrderResponse;
import software.amazon.spapi.models.vendor.orders.v1.Order;
import util.Constants;
import util.Recipe;

/**
 * Vendor Orders API Recipe: Get Single Purchase Order
 * ====================================================
 * 
 * This recipe demonstrates how to retrieve a specific purchase order by its
 * purchase order number using the Vendor Orders API.
 * 
 * Use cases:
 * - Get full details of a specific purchase order
 * - Verify order details before acknowledgement
 * - Look up order information for fulfillment processing
 * 
 * API Operations used:
 * - getPurchaseOrder: Returns a single purchase order by purchaseOrderNumber
 */
public class GetPurchaseOrderRecipe extends Recipe {

    private static final Logger logger = LoggerFactory.getLogger(GetPurchaseOrderRecipe.class);

    private final VendorOrdersApi vendorOrdersApi = new VendorOrdersApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    @Override
    public void start() {
        String purchaseOrderNumber = "4Z32PABC";
        Order order = getPurchaseOrder(purchaseOrderNumber);
        if (order != null) {
            logOrderDetails(order);
        }
    }

    /**
     * Get a specific purchase order by its purchase order number.
     */
    public Order getPurchaseOrder(String purchaseOrderNumber) {
        try {
            GetPurchaseOrderResponse response = vendorOrdersApi.getPurchaseOrder(purchaseOrderNumber);
            if (response.getPayload() != null) {
                logger.info("Successfully retrieved PO: {}", purchaseOrderNumber);
                return response.getPayload();
            }
            logger.warn("No order found for PO: {}", purchaseOrderNumber);
            return null;
        } catch (ApiException | LWAException e) {
            logger.error("Error for PO {}: {}", purchaseOrderNumber, e.getMessage(), e);
            throw new RuntimeException("Failed to get purchase order: " + purchaseOrderNumber, e);
        }
    }

    private void logOrderDetails(Order order) {
        logger.info("========================================");
        logger.info("Purchase Order Details");
        logger.info("========================================");
        logger.info("PO Number: {}", order.getPurchaseOrderNumber());
        logger.info("State: {}", order.getPurchaseOrderState());
        if (order.getOrderDetails() != null) {
            var details = order.getOrderDetails();
            logger.info("Order Date: {}", details.getPurchaseOrderDate());
            logger.info("Order Type: {}", details.getPurchaseOrderType());
            logger.info("Payment Method: {}", details.getPaymentMethod());
            logger.info("Ship Window: {}", details.getShipWindow());
            if (details.getSellingParty() != null) {
                logger.info("Selling Party: {}", details.getSellingParty().getPartyId());
            }
            if (details.getShipToParty() != null) {
                logger.info("Ship To: {}", details.getShipToParty().getPartyId());
            }
            if (details.getItems() != null) {
                logger.info("Line Items ({})", details.getItems().size());
                for (var item : details.getItems()) {
                    logger.info("  - Seq: {} | ASIN: {} | Qty: {} | Price: {} {}", 
                            item.getItemSequenceNumber(),
                            item.getAmazonProductIdentifier(),
                            item.getOrderedQuantity() != null ? item.getOrderedQuantity().getAmount() : "N/A",
                            item.getNetCost() != null ? item.getNetCost().getAmount() : "N/A",
                            item.getNetCost() != null ? item.getNetCost().getCurrencyCode() : "");
                }
            }
        }
    }
}
