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
 * Sample constants for the MCF (Multichannel Fulfillment) order processing recipes.
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

    /**
     * Build a sample getFulfillmentPreview request body.
     */
    public static GetFulfillmentPreviewRequest samplePreviewRequest() {
        Address address = new Address()
                .name("<recipient-name>")
                .addressLine1("<address-line-1>")
                .city("<city>")
                .stateOrRegion("<state>")
                .postalCode("<postal-code>")
                .countryCode("US");

        GetFulfillmentPreviewItem item = new GetFulfillmentPreviewItem()
                .sellerSku("MY-SKU-001")
                .quantity(1)
                .sellerFulfillmentOrderItemId("item-001");

        GetFulfillmentPreviewItemList itemList = new GetFulfillmentPreviewItemList();
        itemList.add(item);

        return new GetFulfillmentPreviewRequest()
                .address(address)
                .items(itemList);
    }

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
                .sellerSku("MY-SKU-001")
                .sellerFulfillmentOrderItemId("item-001")
                .quantity(1);

        CreateFulfillmentOrderItemList itemList = new CreateFulfillmentOrderItemList();
        itemList.add(item);

        return new CreateFulfillmentOrderRequest()
                .sellerFulfillmentOrderId(SAMPLE_SELLER_FULFILLMENT_ORDER_ID)
                .displayableOrderId("TEST-DISPLAY-001")
                .displayableOrderDate(OffsetDateTime.parse("2026-03-27T00:00:00Z"))
                .displayableOrderComment("MCF code recipe test order")
                .shippingSpeedCategory(ShippingSpeedCategory.STANDARD)
                .destinationAddress(address)
                .items(itemList);
    }

    /**
     * Build a sample createFulfillmentOrder request body with Hold action.
     * The order is created but NOT shipped until you call updateFulfillmentOrder
     * with fulfillmentAction=Ship to release it.
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
                .sellerSku("MY-SKU-001")
                .sellerFulfillmentOrderItemId("item-001")
                .quantity(1);

        CreateFulfillmentOrderItemList itemList = new CreateFulfillmentOrderItemList();
        itemList.add(item);

        return new CreateFulfillmentOrderRequest()
                .sellerFulfillmentOrderId(SAMPLE_SELLER_FULFILLMENT_ORDER_ID)
                .displayableOrderId("TEST-DISPLAY-001")
                .displayableOrderDate(OffsetDateTime.parse("2026-03-27T00:00:00Z"))
                .displayableOrderComment("MCF code recipe test order - On Hold")
                .shippingSpeedCategory(ShippingSpeedCategory.STANDARD)
                .fulfillmentAction(FulfillmentAction.HOLD)
                .destinationAddress(address)
                .items(itemList);
    }
}
