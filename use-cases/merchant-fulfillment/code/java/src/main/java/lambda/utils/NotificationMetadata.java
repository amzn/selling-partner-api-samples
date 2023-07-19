package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.Date;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationMetadata {

    @JsonProperty("applicationId")
    public String ApplicationId;

    @JsonProperty("subscriptionId")
    public String SubscriptionId;

    @JsonProperty("publishTime")
    public Date PublishTime;

    @JsonProperty("notificationId")
    public String NotificationId;
}
