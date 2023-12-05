package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class FulfillmentOrderStatusNotification {

    @JsonProperty("EventType")
    public String eventType;

    @JsonProperty("SellerFulfillmentOrderId")
    public String sellerFulfillmentOrderId;

    @JsonProperty("FulfillmentOrderStatus")
    public String fulfillmentOrderStatus;
}
