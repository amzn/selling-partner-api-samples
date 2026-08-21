package multichannel_fulfillment.fulfillment_outbound_v2;

import software.amazon.spapi.api.fulfillment.outbound.v2026_07_04.FulfillmentOrdersApi;
import software.amazon.spapi.api.fulfillment.outbound.v2026_07_04.FulfillmentPreviewsApi;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.CarrierTracking;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.CreateOrderResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.FulfillmentOrder;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.GetOrderPreviewResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.GetOrderResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.ListOrdersResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.ModelPackage;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.Shipment;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.Tracking;
import util.Constants;
import util.Recipe;

import java.time.OffsetDateTime;

/**
 * MCF (Fulfillment Outbound v2026-07-04) Create and Track Order Recipe
 * =====================================================================
 *
 * <p>This recipe demonstrates the standard "happy-path" MCF order flow:</p>
 * <ol>
 *   <li><b>getOrderPreview</b> – Confirm how the order will ship (planned shipments),
 *       estimated shipping weight, delivery/ship windows, and estimated fees before committing.</li>
 *   <li><b>createOrder</b> – Submit the fulfillment order so Amazon ships the items from FBA inventory to the customer.</li>
 *   <li><b>listOrders</b> – Retrieve recently updated orders (reconciliation / confirming acceptance).</li>
 *   <li><b>getOrder</b> – Retrieve the order to read its status and, once shipped, the per-package tracking details.</li>
 * </ol>
 *
 * <p><b>How tracking works in this version of the API (important):</b></p>
 * <p>There is no standalone {@code getPackageTrackingDetails} operation in this version.
 * Package tracking is embedded in the getOrder response at
 * {@code order.shipments[].packages[].tracking.{carrier, amazon, proofOfDelivery}}.
 * Tracking values only populate once the order actually ships, so a freshly created
 * order may not have tracking yet. For real-time, milestone-level tracking, refer to
 * the Tracking API — it is a different API model and out of scope for this recipe.</p>
 *
 * <p><b>Real-world notes:</b></p>
 * <ul>
 *   <li>Steps 1 and 2 typically happen in quick succession at checkout.</li>
 *   <li>Prefer subscribing to the FULFILLMENT_ORDER_STATUS notification over polling getOrder, especially because createOrder may complete asynchronously.</li>
 * </ul>
 *
 * <p><b>DEVELOPER NOTES — Adapting this recipe for production:</b></p>
 * <ol>
 *   <li>Remove the {@code .endpoint(Constants.BACKEND_URL)} call in the API builders. The SDK will automatically route to the correct SP-API endpoint.</li>
 *   <li>Replace the placeholder LWA credentials in the base {@code Recipe} class with your real credentials, ideally loaded from environment variables.</li>
 *   <li>Update the sample payloads in {@code McfConstants} with real SKUs and addresses.</li>
 * </ol>
 *
 * <p>API version: Fulfillment Outbound v2026-07-04</p>
 */
public class McfCreateAndTrackOrderRecipe extends Recipe {

    private final FulfillmentPreviewsApi fulfillmentPreviewsApi;
    private final FulfillmentOrdersApi fulfillmentOrdersApi;

    public McfCreateAndTrackOrderRecipe() {
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
        System.out.println("MCF (v2026-07-04) Create and Track Order Recipe");
        System.out.println("======================================================================");

        // Step 1 – Preview how the order will ship + fees
        getOrderPreview();

        // Step 2 – Create the order
        createOrder();
        String orderId = McfConstants.SAMPLE_ORDER_ID;

        // Step 3 – List recent orders (reconciliation)
        listOrders();

        // Step 4 – Get order status and package tracking
        GetOrderResponse order = getOrder(orderId);
        printPackageTracking(order);

        System.out.println("\n======================================================================");
        System.out.println("MCF create and track order workflow completed successfully.");
        System.out.println("======================================================================");
    }

    // -- Step 1: Get Order Preview --------------------------------------------

    /**
     * Call getOrderPreview to see how the order will ship, its estimated weight and
     * delivery/ship windows, and the estimated fees before committing to createOrder.
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

    // -- Step 3: List Orders --------------------------------------------------

    /**
     * Call listOrders to retrieve recently updated orders. Handy for reconciliation
     * or confirming an order was accepted.
     *
     * <p>Query parameters: {@code updatedAfter} (OffsetDateTime), {@code shipments}
     * ("INCLUDE" default / "EXCLUDE"), {@code pageToken} (from a prior
     * response's pagination.nextToken).</p>
     */
    private ListOrdersResponse listOrders() {
        System.out.println("\n--- Step 3: List Orders ---");
        try {
            OffsetDateTime updatedAfter =
                    OffsetDateTime.parse(McfConstants.SAMPLE_LIST_ORDERS_UPDATED_AFTER);
            // SDK 1.11.1: listOrders(String xAmznFulfillmentServiceId, OffsetDateTime updatedAfter,
            //                        String pageToken, String shipments)
            ListOrdersResponse response = fulfillmentOrdersApi.listOrders(
                    null, updatedAfter, null, null);
            System.out.println("Orders listed successfully.");
            return response;
        } catch (Exception e) {
            System.err.println("Error listing orders: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Step 4: Get Order (status + package tracking) ------------------------

    /**
     * Call getOrder to check the order status and, once shipped, read the per-package
     * tracking details.
     *
     * <p>Key fields in the response:</p>
     * <ul>
     *   <li>order.status (e.g., PROCESSING, COMPLETE, COMPLETE_PARTIAL, CANCELLED)</li>
     *   <li>order.shipments[].status (PROCESSING, SHIPPED, CANCELLED)</li>
     *   <li>order.shipments[].packages[].packageId</li>
     *   <li>order.shipments[].packages[].status (PROCESSING, IN_TRANSIT, DELAYED,
     *       OUT_FOR_DELIVERY, DELIVERED, UNDELIVERABLE, EXPIRED)</li>
     *   <li>order.shipments[].packages[].tracking.carrier.{carrierCode, trackingNumber, trackingUrl}</li>
     *   <li>order.shipments[].packages[].tracking.amazon.{trackingNumber, trackingUrl}</li>
     * </ul>
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

    // -- Helper: read embedded package tracking from the getOrder response ----

    /**
     * Walk order.shipments[].packages[].tracking and print carrier/Amazon tracking.
     * In this version, there is no separate tracking call — tracking is embedded here and only
     * populates once the order ships.
     */
    private void printPackageTracking(GetOrderResponse orderResponse) {
        System.out.println("\n--- Package Tracking (from getOrder) ---");
        if (orderResponse == null || orderResponse.getOrder() == null) {
            System.out.println("No order payload returned.");
            return;
        }
        FulfillmentOrder order = orderResponse.getOrder();
        if (order.getShipments() == null || order.getShipments().isEmpty()) {
            System.out.println("No shipments yet — order may still be processing.");
            return;
        }
        boolean anyTracking = false;
        for (Shipment shipment : order.getShipments()) {
            if (shipment.getPackages() == null) {
                continue;
            }
            for (ModelPackage pkg : shipment.getPackages()) {
                Tracking tracking = pkg.getTracking();
                if (tracking == null) {
                    continue;
                }
                CarrierTracking carrier = tracking.getCarrier();
                if (carrier != null) {
                    anyTracking = true;
                    System.out.println("  Package " + pkg.getPackageId()
                            + " [" + pkg.getStatus() + "] via " + carrier.getCarrierCode()
                            + " — tracking " + carrier.getTrackingNumber()
                            + " (" + carrier.getTrackingUrl() + ")");
                }
            }
        }
        if (!anyTracking) {
            System.out.println("No package tracking available yet — tracking populates once the order ships.");
        }
    }
}
