package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class TrackingDetailsNotificationPayload {

    @JsonProperty("FulfillmentOrderStatusNotification")
    public FulfillmentOrderStatusNotification fulfillmentOrderStatusNotification;
}
