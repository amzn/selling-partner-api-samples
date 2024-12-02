package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.client.model.orders.OrderItem;
import lombok.Data;

import java.util.List;


@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderChangeSummary {

    @JsonProperty("MarketplaceID")
    public String marketplaceID;

    @JsonProperty("OrderStatus")
    public String orderStatus;

    @JsonProperty("PurchaseDate")
    public String purchaseDate;

    @JsonProperty("DestinationPostalCode")
    public String destinationPostalCode;

    @JsonProperty("FulfillmentType")
    public String fulfillmentType;

    @JsonProperty("OrderType")
    public String orderType;

    @JsonProperty("NumberOfItemsShipped")
    public int numberOfItemsShipped;

    @JsonProperty("NumberOfItemsUnshipped")
    public int numberOfItemsUnshipped;

    @JsonProperty("EarliestDeliveryDate")
    public String earliestDeliveryDate;

    @JsonProperty("LatestDeliveryDate")
    public String latestDeliveryDate;

    @JsonProperty("EarliestShipDate")
    public String earliestShipDate;

    @JsonProperty("LatestShipDate")
    public String latestShipDate;

    @JsonProperty("CancelNotifyDate")
    public String cancelNotifyDate;

    @JsonProperty("OrderPrograms")
    public List<String> orderPrograms;

    @JsonProperty("ShippingPrograms")
    public List<String> shippingPrograms;

    @JsonProperty("EasyShipShipmentStatus")
    public String easyShipShipmentStatus;

    @JsonProperty("ElectronicInvoiceStatus")
    public String electronicInvoiceStatus;

    @JsonProperty("OrderChangeTrigger")
    public OrderChangeReason orderChangeTrigger;

    @JsonProperty("OrderItems")
    public List<OrderItem> orderItems;
}
