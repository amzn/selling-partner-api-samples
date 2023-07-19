package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderChangeNotification {

    @JsonProperty("NotificationLevel")
    public String notificationLevel;

    @JsonProperty("AmazonOrderId")
    public String amazonOrderId;

    @JsonProperty("Summary")
    public NotificationOrderSummary summary;
}
