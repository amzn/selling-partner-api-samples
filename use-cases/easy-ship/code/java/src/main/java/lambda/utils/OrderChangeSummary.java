package lambda.utils;

import com.google.gson.annotations.SerializedName;
import io.swagger.client.model.orders.OrderItem;
import lombok.Data;

import java.util.List;


@Data
public class OrderChangeSummary {

    @SerializedName("MarketplaceId")
    public String marketplaceID;

    @SerializedName("OrderStatus")
    public String orderStatus;

    @SerializedName("PurchaseDate")
    public String purchaseDate;

    @SerializedName("DestinationPostalCode")
    public String destinationPostalCode;

    @SerializedName("FulfillmentType")
    public String fulfillmentType;

    @SerializedName("OrderType")
    public String orderType;

    @SerializedName("NumberOfItemsShipped")
    public int numberOfItemsShipped;

    @SerializedName("NumberOfItemsUnshipped")
    public int numberOfItemsUnshipped;

    @SerializedName("EarliestDeliveryDate")
    public String earliestDeliveryDate;

    @SerializedName("LatestDeliveryDate")
    public String latestDeliveryDate;

    @SerializedName("EarliestShipDate")
    public String earliestShipDate;

    @SerializedName("LatestShipDate")
    public String latestShipDate;

    @SerializedName("CancelNotifyDate")
    public String cancelNotifyDate;

    @SerializedName("OrderPrograms")
    public List<String> orderPrograms;

    @SerializedName("ShippingPrograms")
    public List<String> shippingPrograms;

    @SerializedName("EasyShipShipmentStatus")
    public String easyShipShipmentStatus;

    @SerializedName("ElectronicInvoiceStatus")
    public String electronicInvoiceStatus;

    @SerializedName("OrderChangeTrigger")
    public OrderChangeReason orderChangeTrigger;

    @SerializedName("OrderItems")
    public List<OrderItem> orderItems;
}
