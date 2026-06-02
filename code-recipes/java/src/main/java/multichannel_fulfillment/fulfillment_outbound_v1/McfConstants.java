package multichannel_fulfillment.fulfillment_outbound_v1;

import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.Address;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.CreateFulfillmentOrderItem;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.CreateFulfillmentOrderItemList;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.CreateFulfillmentOrderRequest;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.FulfillmentAction;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.GetFulfillmentPreviewItem;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.GetFulfillmentPreviewItemList;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.GetFulfillmentPreviewRequest;
import software.amazon.spapi.models.fulfillment.outbound.v2020_07_01.ShippingSpeedCategory;

import org.threeten.bp.OffsetDateTime;

/**
 * Sample Payloads for the MCF (Multichannel Fulfillment) order processing recipes.
 *
 * <p>When adapting these for your own application, replace the placeholder values
 * marked with angle brackets (e.g., &lt;recipient-name&gt;) with real data.</p>
 *
 * <p><b>DEVELOPER NOTES:</b></p>
 * <ul>
 *   <li>All fields shown below are REQUIRED unless marked as optional.</li>
 *   <li>The address fields must match a valid US shipping address.</li>
 *   <li>sellerSku must be an FBA-enrolled SKU in your seller account.</li>
 *   <li>sellerFulfillmentOrderId is YOUR unique identifier — use your own
 *       order numbering scheme (max 40 characters).</li>
 * </ul>
 */
public class McfConstants {

    public static final String SAMPLE_SELLER_FULFILLMENT_ORDER_ID = "MCF-TEST-ORDER-001";

    // -- Step 1: getFulfillmentPreview request body --------------------------------
    // Use this to check shipping speeds, estimated delivery dates, and fees before committing to an order.

    /**
     * Build a sample getFulfillmentPreview request body.
     */
    public static GetFulfillmentPreviewRequest samplePreviewRequest() {
        Address address = new Address()
                .name("<recipient-name>")
                .addressLine1("<address-line-1>")
                .city("<city>")
                .stateOrRegion("<state>")       // e.g., "WA", "CA", "NY"
                .postalCode("<postal-code>")     // e.g., "98101"
                .countryCode("US");

        GetFulfillmentPreviewItem item = new GetFulfillmentPreviewItem()
                .sellerSku("MY-SKU-001")                       // Your FBA-enrolled SKU
                .quantity(1)
                .sellerFulfillmentOrderItemId("item-001");     // Your unique line-item ID

        GetFulfillmentPreviewItemList itemList = new GetFulfillmentPreviewItemList();
        itemList.add(item);

        return new GetFulfillmentPreviewRequest()
                .address(address)
                .items(itemList);
        // Optional fields you may add:
        // .shippingSpeedCategories(Arrays.asList(ShippingSpeedCategory.STANDARD, ShippingSpeedCategory.EXPEDITED, ShippingSpeedCategory.PRIORITY))
        //
        // .featureConstraints(...)  — Features can be BLANK_BOX or BLOCK_AMZL
    }

    // -- Step 2: createFulfillmentOrder request body -------------------------------
    // Use this to actually submit the MCF order for fulfillment.

    /**
     * Build a sample createFulfillmentOrder request body.
     */
    public static CreateFulfillmentOrderRequest sampleCreateOrderRequest() {
        Address address = new Address()
                .name("<recipient-name>")
                .addressLine1("<address-line-1>")
                .city("<city>")
                .stateOrRegion("<state>")
                .postalCode("<postal-code>")
                .countryCode("US");

        CreateFulfillmentOrderItem item = new CreateFulfillmentOrderItem()
                .sellerSku("MY-SKU-001")                       // Must match an FBA-enrolled SKU
                .sellerFulfillmentOrderItemId("item-001")      // Your unique line-item ID
                .quantity(1);

        CreateFulfillmentOrderItemList itemList = new CreateFulfillmentOrderItemList();
        itemList.add(item);

        return new CreateFulfillmentOrderRequest()
                .sellerFulfillmentOrderId(SAMPLE_SELLER_FULFILLMENT_ORDER_ID)  // Your unique order ID (max 40 chars)
                .displayableOrderId("TEST-DISPLAY-001")                        // Shown to the customer on packing slip
                .displayableOrderDate(OffsetDateTime.parse("2026-03-27T00:00:00Z"))  // Order date shown to customer
                .displayableOrderComment("MCF code recipe test order")         // Comment on packing slip
                .shippingSpeedCategory(ShippingSpeedCategory.STANDARD)         // STANDARD | EXPEDITED | PRIORITY
                .destinationAddress(address)
                .items(itemList);
        // Optional fields you may add:
        // .notificationEmails(Arrays.asList("customer@example.com"))
        // .featureConstraints(...)  — Features can be BLANK_BOX or BLOCK_AMZL
        // .fulfillmentPolicy(FulfillmentPolicy.FILL_OR_KILL)
        //   FillOrKill - it's all-or-nothing, ideal when partial fulfillment isn't acceptable.
        //   FillAll - All fulfillable items are shipped. Any unfulfillable items remain open for the seller to decide.
        //   FillAllAvailable - All fulfillable items are shipped immediately. All unfulfillable items are automatically cancelled.
    }

    // -- Step 2 (alternate): createFulfillmentOrder with Hold action ---------------
    // Use this payload to create an order that is NOT shipped immediately.
    // The order stays on hold until you call updateFulfillmentOrder with fulfillmentAction=Ship to release it.

    /**
     * Build a sample createFulfillmentOrder request body with Hold action.
     */
    public static CreateFulfillmentOrderRequest sampleCreateOrderRequestOnHold() {
        Address address = new Address()
                .name("<recipient-name>")
                .addressLine1("<address-line-1>")
                .city("<city>")
                .stateOrRegion("<state>")
                .postalCode("<postal-code>")
                .countryCode("US");

        CreateFulfillmentOrderItem item = new CreateFulfillmentOrderItem()
                .sellerSku("MY-SKU-001")                       // Must match an FBA-enrolled SKU
                .sellerFulfillmentOrderItemId("item-001")      // Your unique line-item ID
                .quantity(1);

        CreateFulfillmentOrderItemList itemList = new CreateFulfillmentOrderItemList();
        itemList.add(item);

        return new CreateFulfillmentOrderRequest()
                .sellerFulfillmentOrderId(SAMPLE_SELLER_FULFILLMENT_ORDER_ID)  // Your unique order ID (max 40 chars)
                .displayableOrderId("TEST-DISPLAY-001")                        // Shown to the customer on packing slip
                .displayableOrderDate(OffsetDateTime.parse("2026-03-27T00:00:00Z"))  // Order date shown to customer
                .displayableOrderComment("MCF code recipe test order")         // Comment on packing slip
                .shippingSpeedCategory(ShippingSpeedCategory.STANDARD)         // STANDARD | EXPEDITED | PRIORITY
                .fulfillmentAction(FulfillmentAction.HOLD)                     // Hold = do not ship yet
                .destinationAddress(address)
                .items(itemList);
    }
}
