package vendorretailprocurement.orders;

import com.amazon.SellingPartnerAPIAA.LWAException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.orders.v1.VendorOrdersApi;
import software.amazon.spapi.api.vendor.transactionstatus.v1.VendorTransactionApi;
import software.amazon.spapi.models.vendor.orders.v1.*;
import software.amazon.spapi.models.vendor.transactionstatus.v1.GetTransactionResponse;
import software.amazon.spapi.models.vendor.transactionstatus.v1.Transaction;
import util.Constants;
import util.Recipe;

import java.util.List;

/**
 * Vendor Orders Workflow Recipe: Order Acknowledgement Flow
 * ==========================================================
 * 
 * This recipe demonstrates the complete workflow for acknowledging purchase orders:
 * 
 * 1. getPurchaseOrders - Find new orders that need acknowledgement
 * 2. getPurchaseOrder - Get full details of a specific order
 * 3. submitAcknowledgement - Accept/reject the order
 * 4. getTransaction - Verify the acknowledgement was processed
 */
public class OrderAcknowledgementWorkflowRecipe extends Recipe {

    private static final Logger logger = LoggerFactory.getLogger(OrderAcknowledgementWorkflowRecipe.class);

    private final VendorOrdersApi vendorOrdersApi = new VendorOrdersApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    private final VendorTransactionApi transactionApi = new VendorTransactionApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    @Override
    public void start() {
        try {
            logger.info("=== Step 1: Finding new purchase orders ===");
            List<Order> newOrders = findNewOrders();
            if (newOrders.isEmpty()) {
                logger.info("No new orders found. Workflow complete.");
                return;
            }

            logger.info("=== Step 2: Getting order details ===");
            String poNumber = newOrders.get(0).getPurchaseOrderNumber();
            Order orderDetails = getOrderDetails(poNumber);
            if (orderDetails == null) {
                logger.error("Could not retrieve order details for PO: {}", poNumber);
                return;
            }

            logger.info("=== Step 3: Submitting acknowledgement ===");
            String transactionId = acknowledgeOrder(orderDetails);
            if (transactionId == null) {
                logger.error("Failed to submit acknowledgement");
                return;
            }

            logger.info("=== Step 4: Checking transaction status ===");
            checkTransactionStatus(transactionId);

            logger.info("=== Workflow Complete ===");
        } catch (Exception e) {
            logger.error("Workflow failed: {}", e.getMessage(), e);
        }
    }

    private List<Order> findNewOrders() throws ApiException, LWAException {
        GetPurchaseOrdersResponse response = vendorOrdersApi.getPurchaseOrders(
                10L, OffsetDateTime.now().minusDays(7), OffsetDateTime.now(),
                "DESC", null, "true", null, null, null, null, "New", null
        );
        if (response.getPayload() != null && response.getPayload().getOrders() != null) {
            List<Order> orders = response.getPayload().getOrders();
            logger.info("Found {} new orders", orders.size());
            for (Order order : orders) {
                logger.info("  PO: {} | State: {}", order.getPurchaseOrderNumber(), order.getPurchaseOrderState());
            }
            return orders;
        }
        return List.of();
    }

    private Order getOrderDetails(String poNumber) throws ApiException, LWAException {
        GetPurchaseOrderResponse response = vendorOrdersApi.getPurchaseOrder(poNumber);
        if (response.getPayload() != null) {
            Order order = response.getPayload();
            logger.info("Order Details for PO: {}", poNumber);
            logger.info("  State: {}", order.getPurchaseOrderState());
            if (order.getOrderDetails() != null) {
                var details = order.getOrderDetails();
                logger.info("  Order Date: {}", details.getPurchaseOrderDate());
                logger.info("  Ship Window: {}", details.getShipWindow());
                logger.info("  Selling Party: {}", details.getSellingParty() != null ? details.getSellingParty().getPartyId() : "N/A");
                if (details.getItems() != null) {
                    logger.info("  Items: {}", details.getItems().size());
                    for (var item : details.getItems()) {
                        logger.info("    - {} | Qty: {}", item.getAmazonProductIdentifier(),
                                item.getOrderedQuantity() != null ? item.getOrderedQuantity().getAmount() : "N/A");
                    }
                }
            }
            return order;
        }
        return null;
    }

    private String acknowledgeOrder(Order order) throws ApiException, LWAException {
        var details = order.getOrderDetails();
        if (details == null || details.getItems() == null || details.getItems().isEmpty()) {
            logger.warn("No items to acknowledge");
            return null;
        }

        List<OrderAcknowledgementItem> ackItems = details.getItems().stream()
                .map(item -> {
                    int qty = item.getOrderedQuantity() != null ? item.getOrderedQuantity().getAmount() : 0;
                    OrderItemAcknowledgement itemAck = new OrderItemAcknowledgement()
                            .acknowledgementCode(OrderItemAcknowledgement.AcknowledgementCodeEnum.ACCEPTED)
                            .acknowledgedQuantity(new ItemQuantity().amount(qty));
                    return new OrderAcknowledgementItem()
                            .vendorProductIdentifier(item.getVendorProductIdentifier())
                            .orderedQuantity(new ItemQuantity().amount(qty))
                            .netCost(item.getNetCost())
                            .itemAcknowledgements(List.of(itemAck));
                })
                .toList();

        String sellingPartyId = details.getSellingParty() != null ? details.getSellingParty().getPartyId() : "UNKNOWN";

        OrderAcknowledgement orderAck = new OrderAcknowledgement()
                .purchaseOrderNumber(order.getPurchaseOrderNumber())
                .sellingParty(new PartyIdentification().partyId(sellingPartyId))
                .acknowledgementDate(OffsetDateTime.now())
                .items(ackItems);

        SubmitAcknowledgementRequest request = new SubmitAcknowledgementRequest()
                .acknowledgements(List.of(orderAck));

        SubmitAcknowledgementResponse response = vendorOrdersApi.submitAcknowledgement(request);

        if (response.getPayload() != null) {
            String transactionId = response.getPayload().getTransactionId();
            logger.info("Acknowledgement submitted successfully");
            logger.info("  Transaction ID: {}", transactionId);
            return transactionId;
        }
        return null;
    }

    private void checkTransactionStatus(String transactionId) throws ApiException, LWAException {
        GetTransactionResponse response = transactionApi.getTransaction(transactionId);
        if (response.getPayload() != null) {
            Transaction status = response.getPayload().getTransactionStatus();
            logger.info("Transaction Status:");
            logger.info("  Transaction ID: {}", status.getTransactionId());
            logger.info("  Status: {}", status.getStatus());
            if (status.getErrors() != null && !status.getErrors().isEmpty()) {
                logger.warn("  Errors:");
                for (var error : status.getErrors()) {
                    logger.warn("    - {}: {}", error.getCode(), error.getMessage());
                }
            }
        }
    }
}
