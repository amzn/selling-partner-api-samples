package multichannel_fulfillment.fulfillment_outbound_v1;

import software.amazon.spapi.api.fulfillment.outbound.v2020_07_01.FbaOutboundApi;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.CreateFulfillmentOrderResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.FulfillmentShipment;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.FulfillmentShipmentPackage;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.GetFulfillmentOrderResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.GetFulfillmentPreviewResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.GetPackageTrackingDetailsResponse;
import util.Constants;
import util.Recipe;

import java.util.ArrayList;
import java.util.List;

/**
 * Multichannel Fulfillment (MCF) Create and Track Order Recipe
 * ==============================================================
 *
 * <p>This recipe demonstrates the standard MCF workflow in four steps:</p>
 * <ol>
 *   <li><b>getFulfillmentPreview</b> – Check shipping options, estimated dates, and fees.</li>
 *   <li><b>createFulfillmentOrder</b> – Submit the order for fulfillment.</li>
 *   <li><b>getFulfillmentOrder</b> – Poll the order to get status and package details.</li>
 *   <li><b>getPackageTrackingDetails</b> – Get carrier tracking info for each package.</li>
 * </ol>
 *
 * <p><b>DEVELOPER NOTES — Adapting this recipe for production:</b></p>
 * <ol>
 *   <li>Remove the {@code .endpoint(Constants.BACKEND_URL)} call in the API builder.
 *       The SDK will automatically route to the correct SP-API endpoint.</li>
 *   <li>Replace the placeholder LWA credentials in the base {@code Recipe} class
 *       with your real credentials, ideally loaded from environment variables.</li>
 *   <li>Update the sample payloads in {@code McfConstants} with real addresses,
 *       SKUs, and order IDs from your seller account.</li>
 * </ol>
 *
 * <p>API version: Fulfillment Outbound v2020-07-01</p>
 */
public class McfCreateAndTrackOrderRecipe extends Recipe {

    private final FbaOutboundApi fbaOutboundApi;

    public McfCreateAndTrackOrderRecipe() {
        // DEVELOPER NOTE: For production, remove .endpoint(Constants.BACKEND_URL)
        this.fbaOutboundApi = new FbaOutboundApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .build();
    }

    @Override
    protected void start() {
        System.out.println("======================================================================");
        System.out.println("MCF Create and Track Order Recipe");
        System.out.println("======================================================================");

        // Step 1 – Preview shipping options
        GetFulfillmentPreviewResponse preview = getFulfillmentPreview();

        // Step 2 – Create the order
        createFulfillmentOrder();
        String orderId = McfConstants.SAMPLE_SELLER_FULFILLMENT_ORDER_ID;

        // Step 3 – Get order status and package details
        GetFulfillmentOrderResponse order = getFulfillmentOrder(orderId);

        // Step 4 – Track each package using packageNumbers from Step 3
        List<Integer> packageNumbers = extractPackageNumbers(order);
        if (!packageNumbers.isEmpty()) {
            for (int pkgNum : packageNumbers) {
                getPackageTrackingDetails(pkgNum);
            }
        } else {
            System.out.println("No packages found yet — order may still be processing.");
        }

        System.out.println("\n======================================================================");
        System.out.println("✅ MCF create and track order workflow completed successfully.");
        System.out.println("======================================================================");
    }

    // -- Step 1: Get Fulfillment Preview --------------------------------------

    /**
     * Call getFulfillmentPreview to see available shipping speeds,
     * estimated delivery dates, and estimated fees.
     */
    private GetFulfillmentPreviewResponse getFulfillmentPreview() {
        System.out.println("\n--- Step 1: Get Fulfillment Preview ---");
        try {
            GetFulfillmentPreviewResponse response = fbaOutboundApi.getFulfillmentPreview(
                    McfConstants.samplePreviewRequest());
            System.out.println("✅ Fulfillment preview retrieved successfully.");
            return response;
        } catch (Exception e) {
            System.err.println("Error getting fulfillment preview: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Step 2: Create Fulfillment Order -------------------------------------

    /**
     * Call createFulfillmentOrder to submit the MCF order.
     * A successful response means the order was accepted.
     */
    private CreateFulfillmentOrderResponse createFulfillmentOrder() {
        System.out.println("\n--- Step 2: Create Fulfillment Order ---");
        try {
            CreateFulfillmentOrderResponse response = fbaOutboundApi.createFulfillmentOrder(
                    McfConstants.sampleCreateOrderRequest());
            System.out.println("✅ Fulfillment order created: "
                    + McfConstants.SAMPLE_SELLER_FULFILLMENT_ORDER_ID);
            return response;
        } catch (Exception e) {
            System.err.println("Error creating fulfillment order: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Step 3: Get Fulfillment Order ----------------------------------------

    /**
     * Call getFulfillmentOrder to check the order status and retrieve
     * package-level details (including packageNumber for tracking).
     */
    private GetFulfillmentOrderResponse getFulfillmentOrder(String sellerFulfillmentOrderId) {
        System.out.println("\n--- Step 3: Get Fulfillment Order ---");
        try {
            GetFulfillmentOrderResponse response = fbaOutboundApi.getFulfillmentOrder(
                    sellerFulfillmentOrderId);
            System.out.println("✅ Fulfillment order details retrieved for: " + sellerFulfillmentOrderId);
            return response;
        } catch (Exception e) {
            System.err.println("Error getting fulfillment order: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Step 4: Get Package Tracking Details ----------------------------------

    /**
     * Call getPackageTrackingDetails to get carrier and tracking info.
     *
     * <p>Key fields in the response: trackingNumber, carrierCode, trackingEvents.</p>
     */
    private GetPackageTrackingDetailsResponse getPackageTrackingDetails(int packageNumber) {
        System.out.println("\n--- Step 4: Get Package Tracking Details (package " + packageNumber + ") ---");
        try {
            GetPackageTrackingDetailsResponse response = fbaOutboundApi.getPackageTrackingDetails(
                    packageNumber);
            System.out.println("✅ Tracking details retrieved for package: " + packageNumber);
            return response;
        } catch (Exception e) {
            System.err.println("Error getting tracking details: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Helper: extract package numbers from getFulfillmentOrder response -----

    /**
     * Extract packageNumber values from the getFulfillmentOrder response.
     * These are needed to call getPackageTrackingDetails.
     */
    private List<Integer> extractPackageNumbers(GetFulfillmentOrderResponse orderResponse) {
        List<Integer> packageNumbers = new ArrayList<>();
        if (orderResponse == null
                || orderResponse.getPayload() == null
                || orderResponse.getPayload().getFulfillmentShipments() == null) {
            return packageNumbers;
        }
        for (FulfillmentShipment shipment : orderResponse.getPayload().getFulfillmentShipments()) {
            if (shipment.getFulfillmentShipmentPackage() != null) {
                for (FulfillmentShipmentPackage pkg : shipment.getFulfillmentShipmentPackage()) {
                    if (pkg.getPackageNumber() != null) {
                        packageNumbers.add(pkg.getPackageNumber());
                    }
                }
            }
        }
        return packageNumbers;
    }
}
