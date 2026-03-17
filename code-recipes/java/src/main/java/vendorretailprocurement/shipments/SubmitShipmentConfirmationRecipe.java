package vendorretailprocurement.shipments;

import com.amazon.SellingPartnerAPIAA.LWAException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.shipments.v1.VendorShippingApi;
import software.amazon.spapi.models.vendor.shipments.v1.*;
import util.Constants;
import util.Recipe;

import java.util.Arrays;
import java.util.Collections;

/**
 * Vendor Shipments API Recipe: Submit Shipment Confirmation
 * ==========================================================
 * 
 * This recipe demonstrates how to submit shipment confirmations
 * to notify Amazon that items have been shipped.
 * 
 * Use cases:
 * - Confirm shipment of items from a purchase order
 * - Provide tracking information and carrier details
 * - Update Amazon on shipped quantities and packaging
 * 
 * API Operations used:
 * - submitShipmentConfirmations: Submit shipment confirmations (returns transactionId)
 */
public class SubmitShipmentConfirmationRecipe extends Recipe {

    private static final Logger logger = LoggerFactory.getLogger(SubmitShipmentConfirmationRecipe.class);

    private final VendorShippingApi vendorShippingApi = new VendorShippingApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    @Override
    public void start() {
        logger.info("=== Submitting Shipment Confirmation ===");
        
        SubmitShipmentConfirmationsRequest request = createShipmentConfirmationRequest();
        SubmitShipmentConfirmationsResponse response = submitShipmentConfirmations(request);
        
        if (response != null && response.getPayload() != null) {
            logger.info("Shipment confirmation submitted successfully");
            logger.info("Transaction ID: {}", response.getPayload().getTransactionId());
        }
    }

    /**
     * Submit shipment confirmations.
     */
    public SubmitShipmentConfirmationsResponse submitShipmentConfirmations(SubmitShipmentConfirmationsRequest request) {
        try {
            logger.info("Submitting shipment confirmation...");
            
            SubmitShipmentConfirmationsResponse response = vendorShippingApi.submitShipmentConfirmations(request);
            
            logger.info("Shipment confirmation submitted successfully");
            return response;
            
        } catch (ApiException e) {
            logger.error("API Error: {}", e.getMessage());
            throw new RuntimeException("Failed to submit shipment confirmation", e);
        } catch (LWAException e) {
            throw new RuntimeException("Authentication error", e);
        }
    }

    /**
     * Create a sample shipment confirmation request.
     */
    private SubmitShipmentConfirmationsRequest createShipmentConfirmationRequest() {
        // Create item with quantity
        Item item1 = new Item()
                .itemSequenceNumber("001")
                .shippedQuantity(new ItemQuantity()
                        .amount(100)
                        .unitOfMeasure(ItemQuantity.UnitOfMeasureEnum.EACHES));

        Item item2 = new Item()
                .itemSequenceNumber("002")
                .shippedQuantity(new ItemQuantity()
                        .amount(100)
                        .unitOfMeasure(ItemQuantity.UnitOfMeasureEnum.CASES));

        // Create shipment confirmation
        ShipmentConfirmation confirmation = new ShipmentConfirmation()
                .shipmentIdentifier("TestShipmentConfirmation202")
                .shipmentConfirmationDate(OffsetDateTime.now())
                .sellingParty(new PartyIdentification().partyId("ABCD1"))
                .shipFromParty(new PartyIdentification().partyId("EFGH1"))
                .shipToParty(new PartyIdentification().partyId("JKL1"))
                .shipmentConfirmationType(ShipmentConfirmation.ShipmentConfirmationTypeEnum.ORIGINAL)
                .shippedItems(Arrays.asList(item1, item2));

        return new SubmitShipmentConfirmationsRequest()
                .shipmentConfirmations(Collections.singletonList(confirmation));
    }
}
