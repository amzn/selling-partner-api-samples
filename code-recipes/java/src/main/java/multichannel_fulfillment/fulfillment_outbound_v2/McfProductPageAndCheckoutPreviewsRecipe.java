package multichannel_fulfillment.fulfillment_outbound_v2;

import software.amazon.spapi.api.fulfillment.outbound.v2026_07_04.FulfillmentPreviewsApi;
import software.amazon.spapi.api.fulfillment.outbound.v2026_07_04.OffersApi;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.GetOffersResponse;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.GetOrderPreviewResponse;
import util.Constants;
import util.Recipe;

/**
 * MCF (Fulfillment Outbound v2026-07-04) Product Page and Checkout Previews Recipe
 * ================================================================================
 *
 * <p>This recipe demonstrates the two pre-order "preview" calls in this version of the
 * API and when to use each. They answer different questions at different points in the
 * shopper funnel:</p>
 *
 * <ol>
 *   <li><b>getOffers</b> (product/cart page) — "When can the customer get it?"
 *       Item-level delivery promise with an estimated delivery date range and an offer
 *       expiry. Works with a variable-precision address (postal code + country) or even
 *       just the shopper's IP. Fast and lightweight; does not return estimated fees.</li>
 *   <li><b>getOrderPreview</b> (checkout review) — "How will it ship and what will it cost?"
 *       Order-level preview that requires a full delivery address and returns planned
 *       shipments (how the order splits), estimated shipping weight, delivery/ship
 *       intervals, and estimated fees.</li>
 * </ol>
 *
 * <p><b>Real-world notes:</b></p>
 * <ul>
 *   <li>Show getOffers results as a "Get it by &lt;date&gt;" badge early, at scale.</li>
 *   <li>Call getOrderPreview once, at checkout, when you have the full address, to show
 *       shipment breakdown and fees before committing the order.</li>
 *   <li>Neither call reserves inventory or creates an order.</li>
 * </ul>
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
public class McfProductPageAndCheckoutPreviewsRecipe extends Recipe {

    private final OffersApi offersApi;
    private final FulfillmentPreviewsApi fulfillmentPreviewsApi;

    public McfProductPageAndCheckoutPreviewsRecipe() {
        // DEVELOPER NOTE: For production, remove .endpoint(Constants.BACKEND_URL)
        this.offersApi = new OffersApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .build();
        this.fulfillmentPreviewsApi = new FulfillmentPreviewsApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .build();
    }

    @Override
    protected void start() {
        System.out.println("======================================================================");
        System.out.println("MCF (v2026-07-04) Product Page and Checkout Previews Recipe");
        System.out.println("======================================================================");

        // Step 1 – Product-page delivery promise
        getOffers();

        // Step 2 – Checkout-review shipment split + fees
        getOrderPreview();

        System.out.println("\n======================================================================");
        System.out.println("MCF product page and checkout previews workflow completed successfully.");
        System.out.println("======================================================================");
    }

    // -- Step 1: Get Offers (product-page delivery promise) -------------------

    /**
     * Call getOffers to retrieve per-item delivery options (estimated delivery date
     * range + offer expiry).
     *
     * <p>Key fields in the response:</p>
     * <ul>
     *   <li>offerResults[].item.productIdentifier.amazonSku</li>
     *   <li>offerResults[].offers[].expiryTime</li>
     *   <li>offerResults[].offers[].fulfillmentConfiguration.serviceLevel.serviceTier</li>
     *   <li>offerResults[].offers[].fulfillmentConfiguration.serviceLevel.deliveryInterval
     *       (startTime / endTime)</li>
     *   <li>offerResults[].constraints[] (e.g., item out of stock — no offers)</li>
     * </ul>
     */
    private GetOffersResponse getOffers() {
        System.out.println("\n--- Step 1: Get Offers (product-page delivery promise) ---");
        try {
            // SDK 1.11.1: getOffers(GetOffersRequest body, String xAmznFulfillmentServiceId)
            GetOffersResponse response = offersApi.getOffers(
                    McfConstants.sampleOffersRequest(), null);
            System.out.println("Offers retrieved successfully.");
            return response;
        } catch (Exception e) {
            System.err.println("Error getting offers: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    // -- Step 2: Get Order Preview (checkout preview) -------------------------

    /**
     * Call getOrderPreview to retrieve the order-level breakdown: how the order splits
     * into planned shipments, estimated weight, delivery/ship intervals, and estimated fees.
     *
     * <p>Key fields in the response:</p>
     * <ul>
     *   <li>plannedShipments[].estimatedShippingWeight</li>
     *   <li>plannedShipments[].items[]</li>
     *   <li>plannedShipments[].offers[].fulfillmentConfiguration.serviceLevel
     *       (serviceTier, deliveryInterval, shipInterval)</li>
     *   <li>plannedShipments[].offers[].estimatedPrice.rollupPrices[] / totalPrice</li>
     *   <li>constraints[] (anything preventing fulfillment)</li>
     * </ul>
     */
    private GetOrderPreviewResponse getOrderPreview() {
        System.out.println("\n--- Step 2: Get Order Preview (checkout review) ---");
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
}
