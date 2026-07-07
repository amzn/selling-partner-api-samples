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

import java.util.Collections;

/**
 * Vendor Shipments API Recipe: Submit Shipments
 * ==============================================
 * 
 * This recipe demonstrates how to submit shipment requests for vendor orders.
 * Use this to create, update, or cancel shipments.
 * 
 * Use cases:
 * - Create new shipment requests
 * - Update existing shipment information
 * - Cancel shipments
 * 
 * API Operations used:
 * - submitShipments: Submit one or more shipment requests (async - returns transactionId)
 */
public class SubmitShipmentsRecipe extends Recipe {

    private static final Logger logger = LoggerFactory.getLogger(SubmitShipmentsRecipe.class);

    private final VendorShippingApi vendorShippingApi = new VendorShippingApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    @Override
    public void start() {
        logger.info("=== Submitting Shipment Request ===");
        
        // Build a sample shipment request
        Shipment shipment = buildSampleShipment();
        
        // Submit the shipment
        String transactionId = submitShipment(shipment);
        
        if (transactionId != null) {
            logger.info("Shipment submitted successfully");
            logger.info("Transaction ID: {}", transactionId);
            logger.info("Use GetTransaction API to check processing status");
        }
    }

    /**
     * Build a sample shipment request.
     */
    private Shipment buildSampleShipment() {
        // Build purchase order items
        PurchaseOrderItems poItem = new PurchaseOrderItems()
                .itemSequenceNumber("001")
                .vendorProductIdentifier("9782700001659")
                .shippedQuantity(new ItemQuantity()
                        .amount(100)
                        .unitOfMeasure(ItemQuantity.UnitOfMeasureEnum.EACHES));

        PurchaseOrders purchaseOrder = new PurchaseOrders()
                .purchaseOrderNumber("1BBBAAAA")
                .items(Collections.singletonList(poItem));

        // Build shipment measurements
        TransportShipmentMeasurements measurements = new TransportShipmentMeasurements()
                .totalCartonCount(30)
                .totalPalletStackable(30)
                .totalPalletNonStackable(30);

        // Build the shipment
        return new Shipment()
                .vendorShipmentIdentifier("00050003")
                .buyerReferenceNumber("1234567")
                .transactionType(Shipment.TransactionTypeEnum.NEW)
                .transactionDate(OffsetDateTime.now())
                .shipmentFreightTerm(Shipment.ShipmentFreightTermEnum.COLLECT)
                .sellingParty(new PartyIdentification().partyId("PQRSS"))
                .shipFromParty(new PartyIdentification()
                        .partyId("999US")
                        .address(new Address()
                                .name("ABC electronics warehouse")
                                .addressLine1("DEF 1st street")
                                .city("Lisses")
                                .stateOrRegion("abcland")
                                .postalCode("91090")
                                .countryCode("DE")))
                .shipToParty(new PartyIdentification().partyId("ABCDF"))
                .shipmentMeasurements(measurements)
                .purchaseOrders(Collections.singletonList(purchaseOrder));
    }

    /**
     * Submit a shipment request.
     * 
     * @param shipment The shipment to submit
     * @return Transaction ID for tracking, or null if failed
     */
    public String submitShipment(Shipment shipment) {
        try {
            logger.info("Submitting shipment: {}", shipment.getVendorShipmentIdentifier());
            
            SubmitShipments request = new SubmitShipments()
                    .shipments(Collections.singletonList(shipment));

            SubmitShipmentConfirmationsResponse response = vendorShippingApi.submitShipments(request);

            if (response.getPayload() != null && response.getPayload().getTransactionId() != null) {
                return response.getPayload().getTransactionId();
            }
            
            logger.info("Shipment submitted (no transaction ID returned)");
            return null;

        } catch (ApiException e) {
            logger.error("API Error submitting shipment: {}", e.getMessage());
            throw new RuntimeException("Failed to submit shipment", e);
        } catch (LWAException e) {
            logger.error("Authentication error: {}", e.getMessage());
            throw new RuntimeException("Authentication error", e);
        }
    }
}
