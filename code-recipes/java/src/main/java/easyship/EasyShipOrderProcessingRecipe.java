package easyship;

import software.amazon.spapi.api.externalfulfillment.shipments.v2024_09_11.ShipmentProcessingApi;
import software.amazon.spapi.api.externalfulfillment.shipments.v2024_09_11.ShipmentRetrievalApi;
import software.amazon.spapi.models.externalfulfillment.shipments.v2024_09_11.*;
import util.Recipe;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;

/**
 * Easy Ship Order Processing Recipe
 * ==================================
 * Workflow: Fetch → Acknowledge → Package → Shipping Options → Labels
 * 
 * This recipe demonstrates the complete workflow for processing Amazon Easy
 * Ship orders
 * using the External Fulfillment API (also known as SmartConnect API).
 */
public class EasyShipOrderProcessingRecipe extends Recipe {

    private final ShipmentRetrievalApi shipmentRetrievalApi;
    private final ShipmentProcessingApi shipmentProcessingApi;
    private final String marketplaceId;
    private final PackageStatus shipmentStatus;

    private Shipment shipment;
    private String packageId;
    private String shippingOptionId;

    public EasyShipOrderProcessingRecipe() {
        this("A1PA6795UKMFR9", PackageStatus.CREATED); // DE marketplace
    }

    public EasyShipOrderProcessingRecipe(String marketplaceId, PackageStatus shipmentStatus) {
        this.marketplaceId = marketplaceId;
        this.shipmentStatus = shipmentStatus;
        this.packageId = "PKG-" + System.currentTimeMillis();

        this.shipmentRetrievalApi = new ShipmentRetrievalApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(util.Constants.BACKEND_URL)
                .build();

        this.shipmentProcessingApi = new ShipmentProcessingApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(util.Constants.BACKEND_URL)
                .build();
    }

    /**
     * Check if shipment is Easy Ship (shippingType=MARKETPLACE, channelName=MFN).
     */
    private boolean isEasyShipShipment(Shipment shipment) {
        try {
            return "MARKETPLACE".equals(shipment.getShippingInfo().getShippingType().getValue()) &&
                    "MFN".equals(shipment.getMarketplaceAttributes().getChannelName());
        } catch (Exception e) {
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // Step 1: Fetch open shipments
    // -------------------------------------------------------------------------

    private ShipmentsResponse fetchOpenShipments() {
        System.out.println("\n--- Step 1: Fetching Easy Ship orders ---");

        try {
            ShipmentsResponse response = shipmentRetrievalApi.getShipments(
                    shipmentStatus.getValue(),
                    marketplaceId,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null);

            List<Shipment> easyShipShipments = new ArrayList<>();
            if (response.getShipments() != null) {
                for (Shipment s : response.getShipments()) {
                    if (isEasyShipShipment(s)) {
                        easyShipShipments.add(s);
                    }
                }
            }

            if (!easyShipShipments.isEmpty()) {
                this.shipment = easyShipShipments.get(0);
                System.out.println("✅ Found " + easyShipShipments.size() +
                        " Easy Ship order(s) - Shipment ID: " + this.shipment.getId());
            } else {
                System.out.println("⚠️  No Easy Ship orders found");
            }

            return response;
        } catch (Exception e) {
            System.err.println("Error fetching shipments: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -------------------------------------------------------------------------
    // Step 2: Acknowledge shipment
    // -------------------------------------------------------------------------

    private void acknowledgeShipment() {
        System.out.println("\n--- Step 2: Acknowledging shipment ---");

        if (this.shipment == null) {
            System.out.println("⚠️  Skipping: No shipment to confirm was found");
            return;
        }

        try {
            shipmentProcessingApi.processShipment(this.shipment.getId(), "CONFIRM", null);
            System.out.println("✅ Shipment " + this.shipment.getId() + " confirmed");
        } catch (Exception e) {
            System.err.println("Error acknowledging shipment: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -------------------------------------------------------------------------
    // Step 3: Create packages
    // -------------------------------------------------------------------------

    private void createPackages() {
        System.out.println("\n--- Step 3: Creating shipment packages ---");

        if (this.shipment == null) {
            System.out.println("⚠️  Skipping: No shipment available");
            return;
        }

        if (this.shipment.getLineItems() == null || this.shipment.getLineItems().isEmpty()) {
            System.out.println("⚠️  Skipping: No line items in shipment");
            return;
        }

        try {
            // Get recommended package dimensions and weight from shipment
            PackageDimensions packageDimensions;
            Weight packageWeight;

            if (this.shipment.getShippingInfo() != null &&
                    this.shipment.getShippingInfo().getRecommendedPackages() != null &&
                    !this.shipment.getShippingInfo().getRecommendedPackages().isEmpty()) {

                RecommendedPackage recommendedPackage = this.shipment.getShippingInfo()
                        .getRecommendedPackages().get(0);
                packageDimensions = recommendedPackage.getDimensions();
                packageWeight = recommendedPackage.getWeight();

                System.out.println("Using recommended dimensions: " +
                        packageDimensions.getLength().getValue() + "x" +
                        packageDimensions.getWidth().getValue() + "x" +
                        packageDimensions.getHeight().getValue() + " " +
                        packageDimensions.getLength().getDimensionUnit().getValue());
                System.out.println("Using recommended weight: " +
                        packageWeight.getValue() + " " + packageWeight.getWeightUnit().getValue());
            } else {
                System.out.println("⚠️  No recommended package dimensions found, using defaults");
                // Fallback to default dimensions
                Dimension length = new Dimension();
                length.setDimensionUnit(Dimension.DimensionUnitEnum.CM);
                length.setValue(Float.toString(28.0f));

                Dimension width = new Dimension();
                width.setDimensionUnit(Dimension.DimensionUnitEnum.CM);
                width.setValue(Float.toString(26.0f));

                Dimension height = new Dimension();
                height.setDimensionUnit(Dimension.DimensionUnitEnum.CM);
                height.setValue(Float.toString(10.0f));

                packageDimensions = new PackageDimensions();
                packageDimensions.setLength(length);
                packageDimensions.setWidth(width);
                packageDimensions.setHeight(height);

                packageWeight = new Weight();
                packageWeight.setValue(Float.toString(280.0f));
                packageWeight.setWeightUnit(Weight.WeightUnitEnum.G);
            }

            // Build package line items from shipment line items
            PackageLineItem packageLineItem = new PackageLineItem();
            packageLineItem.setPackageLineItemId(this.shipment.getLineItems().get(0).getShipmentLineItemId());
            packageLineItem.setQuantity(1);

            ModelPackage modelPackage = new ModelPackage();
            modelPackage.setId(this.packageId);
            modelPackage.setDimensions(packageDimensions);
            modelPackage.setWeight(packageWeight);

            PackageLineItems packageLineItems = new PackageLineItems();
            packageLineItems.add(packageLineItem);

            modelPackage.setPackageLineItems(packageLineItems);

            Packages packagesBody = new Packages();
            packagesBody.setPackages(List.of(modelPackage));

            shipmentProcessingApi.createPackages(packagesBody, this.shipment.getId());

            System.out.println("✅ Package created successfully");
            System.out.println("Package ID: " + this.packageId);
        } catch (Exception e) {
            System.err.println("Error creating packages: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -------------------------------------------------------------------------
    // Step 4: Retrieve available shipping options
    // -------------------------------------------------------------------------

    private ShippingOptionsResponse retrieveShippingOptions() {
        System.out.println("\n--- Step 4: Retrieving shipping options ---");

        if (this.shipment == null || this.packageId == null) {
            System.out.println("⚠️  Skipping: Missing shipment or package ID");
            return null;
        }

        try {
            ShippingOptionsResponse response = shipmentProcessingApi.retrieveShippingOptions(
                    this.shipment.getId(),
                    this.packageId);

            // For simplicity, this recipe always uses the recommended shipping option if
            // available
            if (response.getRecommendedShippingOption() != null) {
                this.shippingOptionId = response.getRecommendedShippingOption().getShippingOptionId();
                System.out.println("✅ Using recommended shipping option");
                System.out.println("Shipping Option ID: " + this.shippingOptionId);
                if (response.getRecommendedShippingOption().getCarrierName() != null) {
                    System.out.println("Carrier: " + response.getRecommendedShippingOption().getCarrierName());
                }
            } else if (response.getShippingOptions() != null && !response.getShippingOptions().isEmpty()) {
                // Fallback to first option if no recommendation
                ShippingOptions firstShippingOptions = response.getShippingOptions().get(0);
                this.shippingOptionId = firstShippingOptions.getShippingOptionId();

                System.out.println("✅ Found " + response.getShippingOptions().size() + " shipping option(s)");
                System.out.println("Selected Shipping Option ID: " + this.shippingOptionId);
            } else {
                System.out.println("⚠️  No shipping options available");
            }

            return response;
        } catch (Exception e) {
            System.err.println("Error retrieving shipping options: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -------------------------------------------------------------------------
    // Step 5: Generate shipping labels
    // -------------------------------------------------------------------------

    private ShipLabelsResponse generateShippingLabels() {
        System.out.println("\n--- Step 5: Generating shipping labels ---");

        if (this.shipment == null || this.packageId == null || this.shippingOptionId == null) {
            System.out.println("⚠️  Skipping: Missing required IDs");
            return null;
        }

        try {
            // Build request body using model class
            ShipLabelsInput labelsInput = new ShipLabelsInput();
            labelsInput.setPackageIds(List.of(this.packageId));

            ShipLabelsResponse response = shipmentProcessingApi.generateShipLabels(
                    this.shipment.getId(),
                    "GENERATE",
                    labelsInput,
                    this.shippingOptionId);

            if (response.getPackageShipLabelList() != null && !response.getPackageShipLabelList().isEmpty()) {
                System.out.println("✅ Shipping labels generated successfully");
                System.out.println("Number of labels: " + response.getPackageShipLabelList().size());

                // Get the first label for simplicity
                PackageShipLabel label = response.getPackageShipLabelList().get(0);
                System.out.println("\nPackage ID: " + label.getPackageId());
                System.out.println("Tracking ID: " + label.getShipLabelMetadata().getTrackingId());
                System.out.println("Carrier: " + label.getShipLabelMetadata().getCarrierName());

                // Download and open the shipping label
                downloadAndOpenLabel(label.getFileData());
            } else {
                System.out.println("⚠️  No labels generated");
            }

            return response;
        } catch (Exception e) {
            System.err.println("Error generating shipping labels: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    /**
     * Download and open the shipping label from the presigned URL.
     * 
     * The file type is determined from the Content-Type header in the response:
     * - application/zpl: ZPL format (for thermal printers)
     * - application/pdf: PDF format
     * - image/png: PNG format
     * - text/plain: Plain text format
     * 
     * In production, ZPL labels should be sent to a thermal printer.
     * For this recipe, we download and open the label for demonstration.
     */
    private void downloadAndOpenLabel(DocumentV2 fileData) {
        try {
            System.out.println("Downloading label...");

            // Download the label and get content type from response header
            URI uri = new URI(fileData.getUrl());
            HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
            connection.setRequestMethod("GET");

            String contentType = connection.getContentType();
            if (contentType == null) {
                contentType = "application/octet-stream";
            }

            // Determine file extension from content type
            String fileExtension;
            String labelFormat;

            if (contentType.toLowerCase().contains("zpl")) {
                fileExtension = ".zpl";
                labelFormat = "ZPL";
            } else if (contentType.toLowerCase().contains("pdf")) {
                fileExtension = ".pdf";
                labelFormat = "PDF";
            } else if (contentType.toLowerCase().contains("png")) {
                fileExtension = ".png";
                labelFormat = "PNG";
            } else {
                fileExtension = ".txt";
                labelFormat = "TEXT";
            }

            System.out.println("Label Format: " + labelFormat + " (Content-Type: " + contentType + ")");

            // Save to temporary file
            Path tempFile = Files.createTempFile("shipping_label_", fileExtension);

            try (InputStream inputStream = connection.getInputStream()) {
                Files.copy(inputStream, tempFile, StandardCopyOption.REPLACE_EXISTING);
            }

            System.out.println("✅ Label saved to: " + tempFile.toAbsolutePath());

            // In production: Send ZPL files to thermal printer
            if ("ZPL".equals(labelFormat)) {
                System.out.println("ℹ️  Production: Send ZPL file to thermal printer");
            }

            // For this recipe: Open the downloaded file
            System.out.println("🖼️  Opening label...");
            if (java.awt.Desktop.isDesktopSupported()) {
                java.awt.Desktop.getDesktop().open(tempFile.toFile());
            }

        } catch (Exception e) {
            System.err.println("❌ Error: " + e.getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // Main recipe entry point
    // -------------------------------------------------------------------------

    @Override
    protected void start() {
        System.out.println("======================================================================");
        System.out.println("Easy Ship Order Processing Recipe");
        System.out.println("======================================================================");

        // Step 1: Fetch open orders
        fetchOpenShipments();

        // Step 2: Acknowledge shipment
        acknowledgeShipment();

        // Step 3: Create packages
        createPackages();

        // Step 4: Retrieve shipping options
        retrieveShippingOptions();

        // Step 5: Generate shipping labels
        generateShippingLabels();

        System.out.println("\n======================================================================");
        System.out.println("✅ Easy Ship order processing completed successfully");
        System.out.println("======================================================================");
    }
}
