package vendorretailprocurement.orders;

import com.amazon.SellingPartnerAPIAA.LWAException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.orders.v1.VendorOrdersApi;
import software.amazon.spapi.models.vendor.orders.v1.*;
import util.Constants;
import util.Recipe;

import java.util.List;

/**
 * Vendor Orders API Recipe: Submit Acknowledgement
 * =================================================
 * 
 * This recipe demonstrates how to submit acknowledgements for purchase orders
 * using the Vendor Orders API. Vendors use this to accept or reject orders.
 * 
 * Use cases:
 * - Accept a purchase order fully
 * - Partially accept an order (accept some items, reject others)
 * - Reject an order with a reason code
 * 
 * API Operations used:
 * - submitAcknowledgement: Submits acknowledgements for one or more purchase orders
 */
public class SubmitAcknowledgementRecipe extends Recipe {

    private static final Logger logger = LoggerFactory.getLogger(SubmitAcknowledgementRecipe.class);

    private final VendorOrdersApi vendorOrdersApi = new VendorOrdersApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    @Override
    public void start() {
        String transactionId = submitOrderAcknowledgement(
                "TestOrder202", "API01", "028877454078", 10, 10, "10.2"
        );
        logger.info("Acknowledgement submitted. Transaction ID: {}", transactionId);
    }

    /**
     * Submit an acknowledgement to accept a purchase order.
     */
    public String submitOrderAcknowledgement(
            String purchaseOrderNumber,
            String sellingPartyId,
            String vendorProductId,
            int orderedQuantity,
            int acceptedQuantity,
            String netCostAmount) {
        try {
            OrderItemAcknowledgement itemAck = new OrderItemAcknowledgement()
                    .acknowledgementCode(OrderItemAcknowledgement.AcknowledgementCodeEnum.ACCEPTED)
                    .acknowledgedQuantity(new ItemQuantity().amount(acceptedQuantity));

            OrderAcknowledgementItem item = new OrderAcknowledgementItem()
                    .vendorProductIdentifier(vendorProductId)
                    .orderedQuantity(new ItemQuantity().amount(orderedQuantity))
                    .netCost(new Money().amount(netCostAmount))
                    .itemAcknowledgements(List.of(itemAck));

            OrderAcknowledgement orderAck = new OrderAcknowledgement()
                    .purchaseOrderNumber(purchaseOrderNumber)
                    .sellingParty(new PartyIdentification().partyId(sellingPartyId))
                    .acknowledgementDate(OffsetDateTime.now())
                    .items(List.of(item));

            SubmitAcknowledgementRequest request = new SubmitAcknowledgementRequest()
                    .acknowledgements(List.of(orderAck));

            SubmitAcknowledgementResponse response = vendorOrdersApi.submitAcknowledgement(request);

            if (response.getPayload() != null) {
                logger.info("Successfully submitted acknowledgement for PO: {}", purchaseOrderNumber);
                return response.getPayload().getTransactionId();
            }
            logger.warn("No transaction ID returned for PO: {}", purchaseOrderNumber);
            return null;
        } catch (ApiException | LWAException e) {
            logger.error("Error submitting acknowledgement for PO {}: {}", purchaseOrderNumber, e.getMessage(), e);
            throw new RuntimeException("Failed to submit acknowledgement", e);
        }
    }

    /**
     * Submit a rejection for a purchase order item.
     */
    public String submitOrderRejection(
            String purchaseOrderNumber,
            String sellingPartyId,
            String vendorProductId,
            int orderedQuantity,
            OrderItemAcknowledgement.RejectionReasonEnum rejectionReason) {
        try {
            OrderItemAcknowledgement itemAck = new OrderItemAcknowledgement()
                    .acknowledgementCode(OrderItemAcknowledgement.AcknowledgementCodeEnum.REJECTED)
                    .rejectionReason(rejectionReason)
                    .acknowledgedQuantity(new ItemQuantity().amount(0));

            OrderAcknowledgementItem item = new OrderAcknowledgementItem()
                    .vendorProductIdentifier(vendorProductId)
                    .orderedQuantity(new ItemQuantity().amount(orderedQuantity))
                    .itemAcknowledgements(List.of(itemAck));

            OrderAcknowledgement orderAck = new OrderAcknowledgement()
                    .purchaseOrderNumber(purchaseOrderNumber)
                    .sellingParty(new PartyIdentification().partyId(sellingPartyId))
                    .acknowledgementDate(OffsetDateTime.now())
                    .items(List.of(item));

            SubmitAcknowledgementRequest request = new SubmitAcknowledgementRequest()
                    .acknowledgements(List.of(orderAck));

            SubmitAcknowledgementResponse response = vendorOrdersApi.submitAcknowledgement(request);

            if (response.getPayload() != null) {
                logger.info("Successfully submitted rejection for PO: {}", purchaseOrderNumber);
                return response.getPayload().getTransactionId();
            }
            return null;
        } catch (ApiException | LWAException e) {
            logger.error("Error submitting rejection: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to submit rejection", e);
        }
    }
}
