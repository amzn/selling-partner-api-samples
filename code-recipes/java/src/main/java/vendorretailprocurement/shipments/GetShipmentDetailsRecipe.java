package vendorretailprocurement.shipments;

import com.amazon.SellingPartnerAPIAA.LWAException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.shipments.v1.VendorShippingApi;
import software.amazon.spapi.models.vendor.shipments.v1.GetShipmentDetailsResponse;
import software.amazon.spapi.models.vendor.shipments.v1.Shipment;
import util.Constants;
import util.Recipe;

import java.util.List;

/**
 * Vendor Shipments API Recipe: Get Shipment Details
 * ==================================================
 * 
 * This recipe demonstrates how to retrieve shipment details using the
 * Vendor Shipments API. You can filter by date ranges, shipment status,
 * vendor shipment ID, and other criteria.
 * 
 * Use cases:
 * - Track shipment status and carrier information
 * - Get container details and tracking numbers
 * - Monitor delivery progress
 * - Retrieve shipment confirmations
 * 
 * API Operations used:
 * - getShipmentDetails: Returns shipment details based on filters
 */
public class GetShipmentDetailsRecipe extends Recipe {
    private static final Logger logger = LoggerFactory.getLogger(GetShipmentDetailsRecipe.class);

    private final VendorShippingApi vendorShippingApi = new VendorShippingApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    @Override
    public void start() {
        // Example: Get shipments created in the last 7 days
        List<Shipment> shipments = getShipmentsByDateRange(
                OffsetDateTime.now().minusDays(7),
                OffsetDateTime.now()
        );
        logger.info("Found {} shipments", shipments.size());

        for (Shipment shipment : shipments) {
            logShipmentSummary(shipment);
        }
    }

    /**
     * Get shipment details created within a date range.
     */
    public List<Shipment> getShipmentsByDateRange(
            OffsetDateTime createdAfter,
            OffsetDateTime createdBefore) {
        try {
            GetShipmentDetailsResponse response = vendorShippingApi.getShipmentDetails(
                    50L,              // limit
                    "DESC",           // sortOrder
                    null,             // nextToken
                    createdAfter,     // createdAfter
                    createdBefore,    // createdBefore
                    null,             // shipmentConfirmedBefore
                    null,             // shipmentConfirmedAfter
                    null,             // packageLabelCreatedBefore
                    null,             // packageLabelCreatedAfter
                    null,             // shippedBefore
                    null,             // shippedAfter
                    null,             // estimatedDeliveryBefore
                    null,             // estimatedDeliveryAfter
                    null,             // shipmentDeliveryBefore
                    null,             // shipmentDeliveryAfter
                    null,             // requestedPickUpBefore
                    null,             // requestedPickUpAfter
                    null,             // scheduledPickUpBefore
                    null,             // scheduledPickUpAfter
                    null,             // currentShipmentStatus
                    null,             // vendorShipmentIdentifier
                    null,             // buyerReferenceNumber
                    null,             // buyerWarehouseCode
                    null              // sellerWarehouseCode
            );

            if (response.getPayload() != null && response.getPayload().getShipments() != null) {
                return response.getPayload().getShipments();
            }
            return List.of();
        } catch (ApiException | LWAException e) {
            logger.error("Error getting shipment details: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to get shipment details", e);
        }
    }

    /**
     * Get shipment details by vendor shipment identifier.
     */
    public Shipment getShipmentByVendorId(String vendorShipmentId) {
        try {
            GetShipmentDetailsResponse response = vendorShippingApi.getShipmentDetails(
                    1L, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null,
                    null,             // currentShipmentStatus
                    vendorShipmentId, // vendorShipmentIdentifier
                    null, null, null
            );

            if (response.getPayload() != null && response.getPayload().getShipments() != null
                    && !response.getPayload().getShipments().isEmpty()) {
                logger.info("Found shipment for vendor ID: {}", vendorShipmentId);
                return response.getPayload().getShipments().get(0);
            }
            logger.warn("No shipment found for vendor ID: {}", vendorShipmentId);
            return null;
        } catch (ApiException | LWAException e) {
            logger.error("Error getting shipment by vendor ID {}: {}", vendorShipmentId, e.getMessage(), e);
            throw new RuntimeException("Failed to get shipment by vendor ID", e);
        }
    }

    /**
     * Get shipment details by buyer reference number (Amazon's reference).
     */
    public Shipment getShipmentByBuyerReference(String buyerReferenceNumber) {
        try {
            GetShipmentDetailsResponse response = vendorShippingApi.getShipmentDetails(
                    1L, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null,
                    null, null,
                    buyerReferenceNumber, // buyerReferenceNumber
                    null, null
            );

            if (response.getPayload() != null && response.getPayload().getShipments() != null
                    && !response.getPayload().getShipments().isEmpty()) {
                logger.info("Found shipment for buyer reference: {}", buyerReferenceNumber);
                return response.getPayload().getShipments().get(0);
            }
            logger.warn("No shipment found for buyer reference: {}", buyerReferenceNumber);
            return null;
        } catch (ApiException | LWAException e) {
            logger.error("Error getting shipment by buyer reference {}: {}", buyerReferenceNumber, e.getMessage(), e);
            throw new RuntimeException("Failed to get shipment by buyer reference", e);
        }
    }

    private void logShipmentSummary(Shipment shipment) {
        logger.info("----------------------------------------");
        logger.info("Vendor Shipment ID: {}", shipment.getVendorShipmentIdentifier());
        logger.info("Buyer Reference: {}", shipment.getBuyerReferenceNumber());
        logger.info("Status: {}", shipment.getCurrentShipmentStatus());
        
        if (shipment.getTransactionType() != null) {
            logger.info("Transaction Type: {}", shipment.getTransactionType());
        }
        
        if (shipment.getSellingParty() != null) {
            logger.info("Selling Party: {}", shipment.getSellingParty().getPartyId());
        }
        
        if (shipment.getShipToParty() != null) {
            logger.info("Ship To: {}", shipment.getShipToParty().getPartyId());
        }
    }
}
