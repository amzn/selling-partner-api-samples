package lambda.utils.AnyOfferChanged;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.Date;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AnyOfferChangedNotification {

    @JsonProperty("NotificationType")
    public String notificationType;

    @JsonProperty("EventTime")
    public Date eventTime;

    @JsonProperty("Payload")
    public NotificationPayload payload;
}
