package lambda.utils.B2B;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.Date;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class SPAPINotificationB2B {

    @JsonProperty("notificationType")
    public String notificationType;

    @JsonProperty("eventTime")
    public Date eventTime;

    @JsonProperty("payload")
    public NotificationPayloadB2B payload;
}
