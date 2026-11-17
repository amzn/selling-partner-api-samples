package multichannel_fulfillment.fulfillment_outbound_v2;

import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.Address;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.AdditionalServices;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.Amount;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.CreateOrderLineItem;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.CreateOrderRequest;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.GetOffersRequest;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.GetOrderPreviewRequest;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.Money;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.OfferDestination;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.OfferFulfillmentConfiguration;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.OfferItem;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.OrderDestination;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.OrderFulfillmentConfiguration;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.OrderOrigin;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.OrderProduct;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.OrderServices;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.PackagingService;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.PreviewDestination;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.PreviewFulfillmentConfiguration;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.PreviewLineItem;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.PreviewPackagingService;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.PreviewProduct;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.PreviewServiceLevel;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.PreviewServices;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.ProductIdentifier;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.ServiceLevel;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.UpdateOrderFulfillmentConfiguration;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.UpdateOrderRequest;
import software.amazon.spapi.models.fulfillment.outbound.v2026_07_04.VariablePrecisionAddress;

import java.util.Arrays;
import java.util.Collections;

/**
 * Sample payloads for the MCF (Multichannel Fulfillment) Fulfillment Outbound (v2026-07-04) order-processing recipes.
 *
 * <p>These are realistic, US-focused sample payloads for the outbound API workflows. When adapting them for your own application, replace the placeholder
 * values marked with angle brackets (e.g., &lt;recipient-name&gt;) with real data.</p>
 *
 * <p><b>What changed from the legacy version (v2020-07-01) to the new version (2026-07-04):</b></p>
 * <ul>
 *   <li>{@code sellerFulfillmentOrderId}          &rarr; {@code orderId}</li>
 *   <li>{@code destinationAddress}                &rarr; {@code destination.deliveryAddress}</li>
 *   <li>{@code marketplaceId}                     &rarr; {@code origin.countryCode}</li>
 *   <li>{@code items}                             &rarr; {@code lineItems}</li>
 *   <li>item {@code sellerSku}                    &rarr; {@code product.productIdentifier.amazonSku}</li>
 *   <li>item {@code sellerFulfillmentOrderItemId} &rarr; {@code lineItemId}</li>
 *   <li>item {@code quantity: 2}                  &rarr; {@code amount: {unit: "EACHES", value: "2.0"}}</li>
 *   <li>{@code shippingSpeedCategory: "Standard"} &rarr; {@code fulfillmentConfiguration.serviceLevel.serviceTiers: ["STANDARD"]}</li>
 *   <li>{@code fulfillmentAction: "Ship"/"Hold"}  &rarr; {@code fulfillmentConfiguration.action: "SHIP"/"HOLD"}</li>
 *   <li>{@code fulfillmentPolicy: "FillAllAvailable"} &rarr; {@code fulfillmentConfiguration.policy: "FILL_ALL_AVAILABLE"}</li>
 *   <li>{@code featureConstraints: [CHANNEL.X]}   &rarr; top-level {@code channel} field (e.g., "TIKTOK","WALMART","TEMU")</li>
 *   <li>{@code featureConstraints: [BLANK_BOX]}   &rarr; {@code fulfillmentConfiguration.services.packaging}</li>
 * </ul>
 *
 * <p><b>NOTE:</b> These samples cater to the US marketplace. Service tiers are limited to {@code STANDARD} and {@code EXPEDITED} ({@code PRIORITY} is CA/IN/MX only and
 * {@code SCHEDULED} is JP only). Payment-on-delivery is India-only and is intentionally omitted here.</p>
 */
public class McfConstants {

    public static final String SAMPLE_ORDER_ID = "MCF-V2-TEST-ORDER-001";  // Your unique order ID

    // listOrders query parameter — returns orders updated after this time (ISO 8601).
    public static final String SAMPLE_LIST_ORDERS_UPDATED_AFTER = "2026-01-01T00:00:00Z";

    // =========================================================================
    // Sample payloads for RECIPE 1 — Product Page & Checkout Previews
    // =========================================================================

    /**
     * Build a sample getOffers request body.
     *
     * <p>Lightweight, item-level "delivery promise" for the product/cart page. Works with a variable-precision address (postal code + country is enough) or an IP
     * address. Returns per-item delivery date ranges with an expiry — no fees.</p>
     */
    public static GetOffersRequest sampleOffersRequest() {
        // NOTE: OfferFulfillmentConfiguration.serviceLevel() takes a PreviewServiceLevel in this
        // version (which exposes serviceTiers). OfferServiceLevel is a response-only shape.
        PreviewServiceLevel serviceLevel = new PreviewServiceLevel()
                .serviceTiers(Collections.singletonList("STANDARD"));  // US tiers: STANDARD, EXPEDITED

        OfferFulfillmentConfiguration fulfillmentConfiguration = new OfferFulfillmentConfiguration()
                .serviceLevel(serviceLevel);

        // VariablePrecisionAddress: postalCode + countryCode is sufficient.
        // Alternatively, geolocate the shopper by setting only an IP address on the destination
        // via OfferDestination.ipAddress(...).
        VariablePrecisionAddress deliveryAddress = new VariablePrecisionAddress()
                .postalCode("<postal-code>")   // e.g., "98101"
                .countryCode("US");

        OfferDestination destination = new OfferDestination()
                .deliveryAddress(deliveryAddress);

        // Multiple SKUs supported in a single call (one offerResult per item).
        OfferItem item1 = new OfferItem()
                .productIdentifier(new ProductIdentifier().amazonSku("MY-SKU-001"));
        OfferItem item2 = new OfferItem()
                .productIdentifier(new ProductIdentifier().amazonSku("MY-SKU-002"));

        return new GetOffersRequest()
                .fulfillmentConfiguration(fulfillmentConfiguration)
                .origin(new OrderOrigin().countryCode("US"))
                .destination(destination)
                .items(Arrays.asList(item1, item2));
    }

    /**
     * Build a sample getOrderPreview request body.
     *
     * <p>Detailed, order-level preview for the checkout-review step. Requires a full delivery address. Returns planned shipments (how the order splits), estimated
     * shipping weight, delivery/ship intervals, and estimated fees.</p>
     */
    public static GetOrderPreviewRequest samplePreviewRequest() {
        PreviewServiceLevel serviceLevel = new PreviewServiceLevel()
                .serviceTiers(Arrays.asList("STANDARD", "EXPEDITED"));

        // Packaging option replaces the v1 BLANK_BOX feature constraint.
        PreviewFulfillmentConfiguration fulfillmentConfiguration = new PreviewFulfillmentConfiguration()
                .serviceLevel(serviceLevel)
                .services(new PreviewServices()
                        .packaging(new PreviewPackagingService().packagingOption("UNBRANDED")));

        Address deliveryAddress = new Address()
                .name("<recipient-name>")
                .addressLine1("<address-line-1>")
                .city("<city>")
                .stateOrRegion("<state>")      // e.g., "WA"
                .postalCode("<postal-code>")   // e.g., "98101"
                .countryCode("US");

        PreviewDestination destination = new PreviewDestination()
                .deliveryAddress(deliveryAddress);

        PreviewLineItem lineItem = new PreviewLineItem()
                .product(new PreviewProduct()
                        .productIdentifier(new ProductIdentifier().amazonSku("MY-SKU-001"))
                        // Optional declared value per unit (customs/insurance).
                        .perUnitDeclaredValue(new Money().currencyCode("USD").amount("10.00")))
                .amount(new Amount().unit("EACHES").value("1"));

        return new GetOrderPreviewRequest()
                .fulfillmentConfiguration(fulfillmentConfiguration)
                .origin(new OrderOrigin().countryCode("US"))
                .destination(destination)
                .lineItems(Collections.singletonList(lineItem))
                // Set true to omit fee estimates (faster). Default false = include fees.
                .excludeEstimatedFees(false);
    }

    // =========================================================================
    // Sample payload for RECIPE 2 — Create & Track Order and RECIPE 3 — Create & Cancel Order
    // =========================================================================

    /**
     * Build a sample createOrder request body (action = SHIP).
     */
    public static CreateOrderRequest sampleCreateOrderRequest() {
        return baseCreateOrderRequest("SHIP");
        // Optional multi-channel routing: set .channel("TIKTOK") for a marketplace order.
        // The blockAMZL additional service is set in baseCreateOrderRequest (applies to SHIP and HOLD).
    }

    /**
     * Build a sample createOrder request body with action = HOLD (not shipped yet).
     * The order stays on hold until released via updateOrder with action = SHIP.
     */
    public static CreateOrderRequest sampleCreateOrderOnHoldRequest() {
        return baseCreateOrderRequest("HOLD");
    }

    /**
     * Shared builder for the create-order payload. {@code action} is "SHIP" or "HOLD".
     */
    private static CreateOrderRequest baseCreateOrderRequest(String action) {
        ServiceLevel serviceLevel = new ServiceLevel()
                .serviceTiers(Collections.singletonList("STANDARD"));

        AdditionalServices additional = new AdditionalServices();
        additional.put("blockAMZL", "REQUIRED");  // request Amazon block AMZL (Amazon Logistics) as the delivery carrier

        OrderServices services = new OrderServices()
                .packaging(new PackagingService().packagingOption("UNBRANDED"))
                .additional(additional);

        OrderFulfillmentConfiguration fulfillmentConfiguration = new OrderFulfillmentConfiguration()
                .serviceLevel(serviceLevel)
                .action(action)                 // SHIP = fulfill now; HOLD = do not ship until released
                .policy("FILL_ALL_AVAILABLE")   // FILL_OR_KILL | FILL_ALL | FILL_ALL_AVAILABLE
                .services(services);
        // FILL_OR_KILL       - all-or-nothing; ideal when partial fulfillment isn't acceptable.
        // FILL_ALL           - all fulfillable items ship; unfulfillable items stay open for the seller.
        // FILL_ALL_AVAILABLE - all fulfillable items ship immediately; unfulfillable items are cancelled.

        Address deliveryAddress = new Address()
                .name("<recipient-name>")
                .addressLine1("<address-line-1>")
                .city("<city>")
                .stateOrRegion("<state>")
                .postalCode("<postal-code>")
                .countryCode("US")
                .email("<shopper-email>");   // optional; used for notifications
        // Optional drop-off support (new in this version): destination.deliveryNotes("Leave at front desk");

        OrderDestination destination = new OrderDestination()
                .deliveryAddress(deliveryAddress);

        CreateOrderLineItem lineItem = new CreateOrderLineItem()
                .lineItemId("item-001")
                .product(new OrderProduct()
                        .productIdentifier(new ProductIdentifier().amazonSku("MY-SKU-001")))
                .amount(new Amount().unit("EACHES").value("1"));

        return new CreateOrderRequest()
                .orderId(SAMPLE_ORDER_ID)       // Your unique order ID
                .fulfillmentConfiguration(fulfillmentConfiguration)
                .origin(new OrderOrigin().countryCode("US"))
                .destination(destination)
                .lineItems(Collections.singletonList(lineItem));
    }

    // =========================================================================
    // Sample payload for RECIPE 4 — Create On-Hold Order, then Request Shipment
    // =========================================================================

    /**
     * Build a sample updateOrder request body that releases a held order for shipment.
     */
    public static UpdateOrderRequest sampleUpdateOrderShipRequest() {
        return new UpdateOrderRequest()
                .fulfillmentConfiguration(new UpdateOrderFulfillmentConfiguration()
                        .action("SHIP"));
    }
}
