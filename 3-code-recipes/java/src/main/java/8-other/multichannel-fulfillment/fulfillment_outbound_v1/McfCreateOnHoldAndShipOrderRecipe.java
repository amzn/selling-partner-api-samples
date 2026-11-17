package multichannel_fulfillment.fulfillment_outbound_v1;

import software.amazon.spapi.api.fulfillment.outbound.v2020_07_01.FbaOutboundApi;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.CreateFulfillmentOrderResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.FulfillmentAction;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.FulfillmentShipment;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.FulfillmentShipmentPackage;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.GetFulfillmentOrderResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.GetFulfillmentPreviewResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.GetPackageTrackingDetailsResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.UpdateFulfillmentOrderRequest;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.UpdateFulfillmentOrderResponse;
import util.Constants;
import util.Recipe;

import java.util.ArrayList;
import java.util.List;

/**
 * Multichannel Fulfillment (MCF) Create On-Hold and Ship Order Recipe
 * =====================================================================
 *
 * <p>This recipe demonstrates the on-hold order workflow in five steps:</p>
 * <ol>
 *   <li><b>getFulfillmentPreview</b> – Check shipping options and fees.</li>
 *   <li><b>createFulfillmentOrder</b> – Submit the order with fulfillmentAction=Hold.</li>
 *   <li><b>updateFulfillmentOrder</b> – Release the hold and request shipment.</li>
 *   <li><b>getFulfillmentOrder</b> – Get order status and package details.</li>
 *   <li><b>getPackageTrackingDetails</b> – Get carrier tracking info.</li>
 * </ol>
 *
 * <p><b>Real-world notes:</b></p>
 * <ul>
 *   <li>The Hold action is useful for payment validation, fraud checks, or
 *       waiting for customer confirmation before shipping.</li>
 *   <li>Once updated to Ship, the order enters the normal fulfillment pipeline.</li>
 *   <li>You can also change address, shipping speed, or displayable info while on hold.</li>
 * </ul>
 *
 * <p><b>DEVELOPER NOTES — Adapting this recipe for production:</b></p>
 * <ol>
 *   <li>Remove the {@code .endpoint(Constants.BACKEND_URL)} call in the API builder.</li>
 *   <li>Replace the placeholder LWA credentials with real values.</li>
 *   <li>Update the sample payloads in {@code McfConstants}.</li>
 * </ol>
 *
 * <p>API version: Fulfillment Outbound v2020-07-01</p>
 */
public class McfCreateOnHoldAndShipOrderRecipe extends Recipe {

    private final FbaOutboundApi fbaOutboundApi;

    public McfCreateOnHoldAndShipOrderRecipe() {
        // DEVELOPER NOTE: For production, remove .endpoint(Constants.BACKEND_URL)
        this.fbaOutboundApi = new FbaOutboundApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .build();
    }

    @Override
    protected void start() {
        System.out.println("======================================================================");
        System.out.println("MCF Create On-Hold and Ship Order Recipe");
        System.out.println("======================================================================");

        // Step 1 – Preview shipping options
        getFulfillmentPreview();

        // Step 2 – Create order on Hold
        createFulfillmentOrder();
        String orderId = McfConstants.SAMPLE_SELLER_FULFILLMENT_ORDER_ID;

        // Step 3 – Release hold and ship
        updateFulfillmentOrder(orderId);

        // Step 4 – Get order status and package details
        GetFulfillmentOrderResponse order = getFulfillmentOrder(orderId);

        // Step 5 – Track each package
        List<Integer> packageNumbers = extractPackageNumbers(order);
        if (!packageNumbers.isEmpty()) {
            for (int pkgNum : packageNumbers) {
                getPackageTrackingDetails(pkgNum);
            }
        } else {
            System.out.println("No packages found yet — order may still be processing.");
        }

        System.out.println("\n======================================================================");
        System.out.println("✅ MCF create on-hold and ship order workflow completed successfully.");
        System.out.println("======================================================================");
    }

    // -- Step 1: Get Fulfillment Preview --------------------------------------

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

    // -- Step 2: Create Fulfillment Order (on Hold) ---------------------------

    /**
     * Create the order with fulfillmentAction=Hold.
     * The order is NOT shipped until explicitly released via updateFulfillmentOrder.
     */
    private CreateFulfillmentOrderResponse createFulfillmentOrder() {
        System.out.println("\n--- Step 2: Create Fulfillment Order (Hold) ---");
        try {
            CreateFulfillmentOrderResponse response = fbaOutboundApi.createFulfillmentOrder(
                    McfConstants.sampleCreateOrderRequestOnHold());
            System.out.println("✅ Fulfillment order created on Hold: "
                    + McfConstants.SAMPLE_SELLER_FULFILLMENT_ORDER_ID);
            return response;
        } catch (Exception e) {
            System.err.println("Error creating fulfillment order: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Step 3: Update Fulfillment Order (release hold, ship) ----------------

    /**
     * Release the hold and request shipment by setting fulfillmentAction to Ship.
     */
    private UpdateFulfillmentOrderResponse updateFulfillmentOrder(String sellerFulfillmentOrderId) {
        System.out.println("\n--- Step 3: Update Fulfillment Order (Ship) ---");
        try {
            UpdateFulfillmentOrderRequest updateBody = new UpdateFulfillmentOrderRequest()
                    .fulfillmentAction(FulfillmentAction.SHIP);

            UpdateFulfillmentOrderResponse response = fbaOutboundApi.updateFulfillmentOrder(
                    sellerFulfillmentOrderId, updateBody);
            System.out.println("✅ Order released from hold — shipment requested.");
            return response;
        } catch (Exception e) {
            System.err.println("Error updating fulfillment order: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Step 4: Get Fulfillment Order ----------------------------------------

    private GetFulfillmentOrderResponse getFulfillmentOrder(String sellerFulfillmentOrderId) {
        System.out.println("\n--- Step 4: Get Fulfillment Order ---");
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

    // -- Step 5: Get Package Tracking Details ----------------------------------

    private GetPackageTrackingDetailsResponse getPackageTrackingDetails(int packageNumber) {
        System.out.println("\n--- Step 5: Get Package Tracking Details (package " + packageNumber + ") ---");
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

    // -- Helper: extract package numbers --------------------------------------

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
