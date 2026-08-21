package multichannel_fulfillment.fulfillment_outbound_v2;

import software.amazon.spapi.api.fulfillment.outbound.v2026_07_04.FulfillmentOrdersApi;
import software.amazon.spapi.api.fulfillment.outbound.v2026_07_04.FulfillmentPreviewsApi;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.CancelOrderResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.CreateOrderResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.GetOrderPreviewResponse;
import util.Constants;
import util.Recipe;

/**
 * MCF (Fulfillment Outbound v2026-07-04) Create and Cancel Order Recipe
 * =====================================================================
 *
 * <p>This recipe demonstrates creating an MCF order and then cancelling it before it is
 * fulfilled:</p>
 * <ol>
 *   <li><b>getOrderPreview</b> — Preview how the order will ship and its estimated fees.</li>
 *   <li><b>createOrder</b> — Submit the fulfillment order.</li>
 *   <li><b>cancelOrder</b> — Request that Amazon stop attempting to fulfill the order.</li>
 * </ol>
 *
 * <p><b>When does cancellation succeed?</b></p>
 * <p>Cancellation is only possible while the order has not yet entered fulfillment
 * processing. Once items are picked/packed/shipped, a cancel request may be rejected.
 * cancelOrder returns HTTP 202 (Accepted) and is best-effort; to confirm the final
 * outcome, call getOrder and check that {@code order.status} is {@code CANCELLED}.</p>
 *
 * <p><b>DEVELOPER NOTES — Adapting this recipe for production:</b></p>
 * <ol>
 *   <li>Remove the {@code .endpoint(Constants.BACKEND_URL)} call in the API builders.
 *       The SDK will automatically route to the correct SP-API endpoint.</li>
 *   <li>Replace the placeholder LWA credentials in the base {@code Recipe} class
 *       with your real credentials, ideally loaded from environment variables.</li>
 *   <li>Update the sample payloads in {@code McfConstants} with real SKUs and addresses.</li>
 * </ol>
 *
 * <p>API version: Fulfillment Outbound v2026-07-04</p>
 */
public class McfCreateAndCancelOrderRecipe extends Recipe {

    private final FulfillmentPreviewsApi fulfillmentPreviewsApi;
    private final FulfillmentOrdersApi fulfillmentOrdersApi;

    public McfCreateAndCancelOrderRecipe() {
        // DEVELOPER NOTE: For production, remove .endpoint(Constants.BACKEND_URL)
        this.fulfillmentPreviewsApi = new FulfillmentPreviewsApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .build();
        this.fulfillmentOrdersApi = new FulfillmentOrdersApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .build();
    }

    @Override
    protected void start() {
        System.out.println("======================================================================");
        System.out.println("MCF (v2026-07-04) Create and Cancel Order Recipe");
        System.out.println("======================================================================");

        // Step 1 – Preview how the order will ship + fees
        getOrderPreview();

        // Step 2 – Create the order
        createOrder();
        String orderId = McfConstants.SAMPLE_ORDER_ID;

        // Step 3 – Cancel the order before fulfillment
        cancelOrder(orderId);

        System.out.println("\n======================================================================");
        System.out.println("MCF create and cancel order workflow completed successfully.");
        System.out.println("======================================================================");
    }

    // -- Step 1: Get Order Preview --------------------------------------------

    /**
     * Call getOrderPreview to preview shipment split, weight, and fees before committing.
     */
    private GetOrderPreviewResponse getOrderPreview() {
        System.out.println("\n--- Step 1: Get Order Preview ---");
        try {
            // SDK 1.11.1: getOrderPreview(GetOrderPreviewRequest body, String xAmznFulfillmentServiceId)
            GetOrderPreviewResponse response = fulfillmentPreviewsApi.getOrderPreview(
                    McfConstants.samplePreviewRequest(), null);
            System.out.println("Order preview retrieved successfully.");
            return response;
        } catch (Exception e) {
            System.err.println("Error getting order preview: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Step 2: Create Order -------------------------------------------------

    /**
     * Call createOrder to submit the MCF order. A successful (200/202) response means
     * the order was accepted; creation may complete asynchronously.
     */
    private CreateOrderResponse createOrder() {
        System.out.println("\n--- Step 2: Create Order ---");
        try {
            // SDK 1.11.1: createOrder(CreateOrderRequest body, String xAmznFulfillmentServiceId)
            CreateOrderResponse response = fulfillmentOrdersApi.createOrder(
                    McfConstants.sampleCreateOrderRequest(), null);
            System.out.println("Fulfillment order created: " + McfConstants.SAMPLE_ORDER_ID);
            return response;
        } catch (Exception e) {
            System.err.println("Error creating order: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Step 3: Cancel Order -------------------------------------------------

    /**
     * Call cancelOrder to request Amazon stop fulfilling the order. Returns HTTP 202
     * (Accepted). Cancellation is best-effort: it only succeeds if the order has not yet
     * entered fulfillment. To verify, call getOrder and check {@code order.status == "CANCELLED"}.
     */
    private CancelOrderResponse cancelOrder(String orderId) {
        System.out.println("\n--- Step 3: Cancel Order ---");
        try {
            // SDK 1.11.1: cancelOrder(String orderId, String xAmznFulfillmentServiceId)
            CancelOrderResponse response = fulfillmentOrdersApi.cancelOrder(orderId, null);
            System.out.println("Cancel request accepted for: " + orderId);
            return response;
        } catch (Exception e) {
            System.err.println("Error cancelling order: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }
}
