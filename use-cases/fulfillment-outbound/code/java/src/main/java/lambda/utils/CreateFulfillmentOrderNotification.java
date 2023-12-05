package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateFulfillmentOrderNotification {

    @JsonProperty("marketplaceId")
    public String marketplaceId;

    @JsonProperty("sellerFulfillmentOrderId")
    public String sellerFulfillmentOrderId;

    @JsonProperty("displayableOrderId")
    public String displayableOrderId;

    @JsonProperty("displayableOrderDate")
    public String displayableOrderDate;

    @JsonProperty("displayableOrderComment")
    public String displayableOrderComment;

    @JsonProperty("shippingSpeedCategory")
    public String shippingSpeedCategory;

    @JsonProperty("deliveryWindow")
    public DeliveryWindow deliveryWindow;

    @JsonProperty("destinationAddress")
    public DestinationAddress destinationAddress; 

    @JsonProperty("fulfillmentAction")
    public String fulfillmentAction;

    @JsonProperty("fulfillmentPolicy")
    public String fulfillmentPolicy;
    
    @JsonProperty("codSettings")
    public CODSettings codSettings;

    @JsonProperty("shipFromCountryCode")
    public String shipFromCountryCode;

    @JsonProperty("notificationEmails")
    public List<String> notificationEmails;

    @JsonProperty("featureConstraints")
    public List<FeatureSettings> featureConstraints;

    @JsonProperty("items")
    public List<OrderItem> items;
}
