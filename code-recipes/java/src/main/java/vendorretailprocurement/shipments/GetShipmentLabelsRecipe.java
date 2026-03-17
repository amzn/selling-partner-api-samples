package vendorretailprocurement.shipments;

import com.amazon.SellingPartnerAPIAA.LWAException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.shipments.v1.VendorShippingApi;
import software.amazon.spapi.models.vendor.shipments.v1.GetShipmentLabels;
import software.amazon.spapi.models.vendor.shipments.v1.TransportLabel;
import util.Constants;
import util.Recipe;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;

/**
 * Vendor Shipments API Recipe: Get Shipment Labels
 * =================================================
 * 
 * This recipe demonstrates how to retrieve shipping labels using the
 * Vendor Shipments API. Labels contain carrier information, tracking IDs,
 * and the actual label data (base64 encoded).
 * 
 * Use cases:
 * - Download shipping labels for printing
 * - Get carrier codes and tracking information
 * - Retrieve labels by date range or shipment ID
 * 
 * API Operations used:
 * - getShipmentLabels: Returns shipping labels based on filters
 */
public class GetShipmentLabelsRecipe extends Recipe {
    private static final Logger logger = LoggerFactory.getLogger(GetShipmentLabelsRecipe.class);

    private final VendorShippingApi vendorShippingApi = new VendorShippingApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    @Override
    public void start() {
        // Example: Get labels created in the last 7 days
        List<TransportLabel> labels = getLabelsByDateRange(
                OffsetDateTime.now().minusDays(7),
                OffsetDateTime.now()
        );
        logger.info("Found {} labels", labels.size());

        for (TransportLabel label : labels) {
            logLabelSummary(label);
        }
    }

    /**
     * Get shipping labels created within a date range.
     */
    public List<TransportLabel> getLabelsByDateRange(
            OffsetDateTime labelCreatedAfter,
            OffsetDateTime labelCreatedBefore) {
        try {
            GetShipmentLabels response = vendorShippingApi.getShipmentLabels(
                    50L,                  // limit
                    "DESC",               // sortOrder
                    null,                 // nextToken
                    labelCreatedAfter,    // labelCreatedAfter
                    labelCreatedBefore,   // labelCreatedBefore
                    null,                 // buyerReferenceNumber
                    null,                 // vendorShipmentIdentifier
                    null                  // sellerWarehouseCode
            );

            if (response.getPayload() != null && response.getPayload().getTransportLabels() != null) {
                return response.getPayload().getTransportLabels();
            }
            return List.of();
        } catch (ApiException | LWAException e) {
            logger.error("Error getting shipment labels: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to get shipment labels", e);
        }
    }

    /**
     * Get shipping labels by vendor shipment identifier.
     */
    public List<TransportLabel> getLabelsByVendorShipmentId(String vendorShipmentId) {
        try {
            GetShipmentLabels response = vendorShippingApi.getShipmentLabels(
                    50L, null, null, null, null,
                    null,                 // buyerReferenceNumber
                    vendorShipmentId,     // vendorShipmentIdentifier
                    null                  // sellerWarehouseCode
            );

            if (response.getPayload() != null && response.getPayload().getTransportLabels() != null) {
                logger.info("Found {} labels for vendor shipment: {}", 
                        response.getPayload().getTransportLabels().size(), vendorShipmentId);
                return response.getPayload().getTransportLabels();
            }
            logger.warn("No labels found for vendor shipment: {}", vendorShipmentId);
            return List.of();
        } catch (ApiException | LWAException e) {
            logger.error("Error getting labels for shipment {}: {}", vendorShipmentId, e.getMessage(), e);
            throw new RuntimeException("Failed to get labels by vendor shipment ID", e);
        }
    }

    /**
     * Get shipping labels by buyer reference number.
     */
    public List<TransportLabel> getLabelsByBuyerReference(String buyerReferenceNumber) {
        try {
            GetShipmentLabels response = vendorShippingApi.getShipmentLabels(
                    50L, null, null, null, null,
                    buyerReferenceNumber, // buyerReferenceNumber
                    null,                 // vendorShipmentIdentifier
                    null                  // sellerWarehouseCode
            );

            if (response.getPayload() != null && response.getPayload().getTransportLabels() != null) {
                logger.info("Found {} labels for buyer reference: {}", 
                        response.getPayload().getTransportLabels().size(), buyerReferenceNumber);
                return response.getPayload().getTransportLabels();
            }
            logger.warn("No labels found for buyer reference: {}", buyerReferenceNumber);
            return List.of();
        } catch (ApiException | LWAException e) {
            logger.error("Error getting labels for buyer reference {}: {}", buyerReferenceNumber, e.getMessage(), e);
            throw new RuntimeException("Failed to get labels by buyer reference", e);
        }
    }

    private void logLabelSummary(TransportLabel label) {
        logger.info("----------------------------------------");
        logger.info("Label Created: {}", label.getLabelCreateDateTime());
        
        if (label.getShipmentInformation() != null) {
            var shipInfo = label.getShipmentInformation();
            logger.info("Buyer Reference: {}", shipInfo.getBuyerReferenceNumber());
            
            if (shipInfo.getVendorDetails() != null) {
                logger.info("Vendor Shipment ID: {}", shipInfo.getVendorDetails().getVendorShipmentIdentifier());
            }
            
            if (shipInfo.getShipToParty() != null) {
                logger.info("Ship To: {}", shipInfo.getShipToParty().getPartyId());
            }
        }
        
        if (label.getLabelData() != null && !label.getLabelData().isEmpty()) {
            logger.info("Label Data: {} labels available", label.getLabelData().size());
            
            // Demonstrate how to decode and use the label PDF
            for (var labelData : label.getLabelData()) {
                logger.info("  - Seq: {} | Format: {} | Carrier: {} | Tracking: {}",
                        labelData.getLabelSequenceNumber(),
                        labelData.getLabelFormat(),
                        labelData.getCarrierCode(),
                        labelData.getTrackingId());
                
                // The label is base64-encoded PDF - decode it to bytes
                if (labelData.getLabel() != null && !labelData.getLabel().isEmpty()) {
                    byte[] pdfBytes = Base64.getDecoder().decode(labelData.getLabel());
                    
                    // Save the PDF to current directory
                    String filename = "label_" + labelData.getTrackingId() + ".pdf";
                    Path filePath = Path.of(filename).toAbsolutePath();
                    try {
                        Files.write(filePath, pdfBytes);
                        logger.info("    Saved: {} ({} bytes)", filePath, pdfBytes.length);
                    } catch (IOException e) {
                        logger.error("    Failed to save {}: {}", filePath, e.getMessage());
                    }
                }
            }
        }
    }
}
