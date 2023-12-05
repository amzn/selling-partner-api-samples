package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateNotificationPayload {

    @JsonProperty("createFulfillmentOrderNotification")
    public CreateFulfillmentOrderNotification createFulfillmentOrderNotification;
}
