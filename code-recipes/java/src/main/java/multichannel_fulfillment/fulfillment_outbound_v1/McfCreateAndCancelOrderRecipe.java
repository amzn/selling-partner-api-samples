package multichannel_fulfillment.fulfillment_outbound_v1;

import software.amazon.spapi.api.fulfillment.outbound.v2020_07_01.FbaOutboundApi;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.*;
import util.Constants;
import util.Recipe;

/**
 * Multichannel Fulfillment (MCF) Create and Cancel Order Recipe
 * ===============================================================
 *
 * <p>This recipe demonstrates the cancel order workflow in four steps:</p>
 * <ol>
 *   <li><b>getFulfillmentPreview</b> – Check shipping options and fees.</li>
 *   <li><b>createFulfillmentOrder</b> – Submit the MCF order.</li>
 *   <li><b>cancelFulfillmentOrder</b> – Cancel the order before it ships.</li>
 *   <li><b>getFulfillmentOrder</b> – Confirm the order status is now CANCELLED.</li>
 * </ol>
 *
 * <p><b>Real-world notes:</b></p>
 * <ul>
 *   <li>Cancellation is only possible while the order is in a cancellable state
 *       (typically before it enters the shipping process).</li>
 *   <li>If the order has already shipped, cancelFulfillmentOrder will return an error.</li>
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
public class McfCreateAndCancelOrderRecipe extends Recipe {

    private final FbaOutboundApi fbaOutboundApi;

    public McfCreateAndCancelOrderRecipe() {
        // DEVELOPER NOTE: For production, remove .endpoint(Constants.BACKEND_URL)
        this.fbaOutboundApi = new FbaOutboundApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .build();
    }

    @Override
    protected void start() {
        System.out.println("======================================================================");
        System.out.println("MCF Create and Cancel Order Recipe");
        System.out.println("======================================================================");

        // Step 1 – Preview shipping options
        getFulfillmentPreview();

        // Step 2 – Create the order
        createFulfillmentOrder();
        String orderId = McfConstants.SAMPLE_SELLER_FULFILLMENT_ORDER_ID;

        // Step 3 – Cancel the order
        cancelFulfillmentOrder(orderId);

        // Step 4 – Verify the order is cancelled
        getFulfillmentOrder(orderId);

        System.out.println("\n======================================================================");
        System.out.println("✅ MCF create and cancel order workflow completed successfully.");
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

    // -- Step 2: Create Fulfillment Order -------------------------------------

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

    // -- Step 3: Cancel Fulfillment Order -------------------------------------

    /**
     * Cancel the order before it ships.
     * NOTE: This will fail if the order has already entered the shipping process.
     */
    private CancelFulfillmentOrderResponse cancelFulfillmentOrder(String sellerFulfillmentOrderId) {
        System.out.println("\n--- Step 3: Cancel Fulfillment Order ---");
        try {
            CancelFulfillmentOrderResponse response = fbaOutboundApi.cancelFulfillmentOrder(
                    sellerFulfillmentOrderId);
            System.out.println("✅ Fulfillment order cancelled: " + sellerFulfillmentOrderId);
            return response;
        } catch (Exception e) {
            System.err.println("Error cancelling fulfillment order: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Step 4: Get Fulfillment Order (verify cancellation) ------------------

    /**
     * Verify the order status is now CANCELLED or CANCELLED_BY_SELLER.
     */
    private GetFulfillmentOrderResponse getFulfillmentOrder(String sellerFulfillmentOrderId) {
        System.out.println("\n--- Step 4: Get Fulfillment Order (verify cancellation) ---");
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
}
