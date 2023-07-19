package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationOrderSummary {

    @JsonProperty("OrderStatus")
    public String orderStatus;

    @JsonProperty("FulfillmentType")
    public String fulfillmentType;
}
