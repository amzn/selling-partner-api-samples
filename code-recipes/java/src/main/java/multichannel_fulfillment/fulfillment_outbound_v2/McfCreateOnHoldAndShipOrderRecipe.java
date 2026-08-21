package multichannel_fulfillment.fulfillment_outbound_v2;

import software.amazon.spapi.api.fulfillment.outbound.v2026_07_04.FulfillmentOrdersApi;
import software.amazon.spapi.api.fulfillment.outbound.v2026_07_04.FulfillmentPreviewsApi;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.CreateOrderResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.GetOrderPreviewResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.GetOrderResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.UpdateOrderResponse;
import util.Constants;
import util.Recipe;

/**
 * MCF (Fulfillment Outbound v2026-07-04) Create On-Hold and Ship Order Recipe
 * ===========================================================================
 *
 * <p>This recipe demonstrates creating an MCF order that is placed on hold (not shipped
 * immediately) and later released for shipment:</p>
 * <ol>
 *   <li><b>getOrderPreview</b> — Preview how the order will ship and its estimated fees.</li>
 *   <li><b>createOrder</b> (action = HOLD) — Submit the order without shipping it.
 *       The order is held until you explicitly release it.</li>
 *   <li><b>updateOrder</b> (action = SHIP) — Release the held order for shipment.</li>
 *   <li><b>getOrder</b> — Confirm the order moved out of hold and read its status / shipments.</li>
 * </ol>
 *
 * <p><b>Why hold an order?</b></p>
 * <p>Holding is useful when you want to reserve fulfillment but defer shipment — for
 * example, to allow a cancellation window, batch releases, or wait on a payment or fraud
 * check before the package leaves the fulfillment center. The order can be held for 14 days.</p>
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
public class McfCreateOnHoldAndShipOrderRecipe extends Recipe {

    private final FulfillmentPreviewsApi fulfillmentPreviewsApi;
    private final FulfillmentOrdersApi fulfillmentOrdersApi;

    public McfCreateOnHoldAndShipOrderRecipe() {
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
        System.out.println("MCF (v2026-07-04) Create On-Hold and Ship Order Recipe");
        System.out.println("======================================================================");

        // Step 1 – Preview how the order will ship + fees
        getOrderPreview();

        // Step 2 – Create the order on HOLD
        createOrderOnHold();
        String orderId = McfConstants.SAMPLE_ORDER_ID;

        // Step 3 – Release the held order for shipment
        updateOrderToShip(orderId);

        // Step 4 – Confirm the order was released from hold
        getOrder(orderId);

        System.out.println("\n======================================================================");
        System.out.println("MCF create on-hold and ship order workflow completed successfully.");
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

    // -- Step 2: Create Order on HOLD -----------------------------------------

    /**
     * Call createOrder with fulfillmentConfiguration.action = HOLD so the order is
     * accepted and reserved, but NOT shipped yet.
     */
    private CreateOrderResponse createOrderOnHold() {
        System.out.println("\n--- Step 2: Create Order (action=HOLD) ---");
        try {
            // SDK 1.11.1: createOrder(CreateOrderRequest body, String xAmznFulfillmentServiceId)
            CreateOrderResponse response = fulfillmentOrdersApi.createOrder(
                    McfConstants.sampleCreateOrderOnHoldRequest(), null);
            System.out.println("On-hold order created: " + McfConstants.SAMPLE_ORDER_ID);
            return response;
        } catch (Exception e) {
            System.err.println("Error creating on-hold order: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Step 3: Update Order to SHIP -----------------------------------------

    /**
     * Call updateOrder with fulfillmentConfiguration.action = SHIP to release the held
     * order. In this version only the action is required in the body — no need to resend
     * the full order. Returns HTTP 202 (Accepted).
     */
    private UpdateOrderResponse updateOrderToShip(String orderId) {
        System.out.println("\n--- Step 3: Update Order (action=SHIP) ---");
        try {
            // SDK 1.11.1: updateOrder(UpdateOrderRequest body, String orderId, String xAmznFulfillmentServiceId)
            UpdateOrderResponse response = fulfillmentOrdersApi.updateOrder(
                    McfConstants.sampleUpdateOrderShipRequest(), orderId, null);
            System.out.println("Ship request accepted for: " + orderId);
            return response;
        } catch (Exception e) {
            System.err.println("Error updating order: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Step 4: Get Order ----------------------------------------------------

    /**
     * Call getOrder to confirm the order was released from hold and read its current
     * status / shipments.
     */
    private GetOrderResponse getOrder(String orderId) {
        System.out.println("\n--- Step 4: Get Order ---");
        try {
            // SDK 1.11.1: getOrder(String orderId, String xAmznFulfillmentServiceId, String shipments)
            GetOrderResponse response = fulfillmentOrdersApi.getOrder(orderId, null, null);
            System.out.println("Order details retrieved for: " + orderId);
            return response;
        } catch (Exception e) {
            System.err.println("Error getting order: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }
}
