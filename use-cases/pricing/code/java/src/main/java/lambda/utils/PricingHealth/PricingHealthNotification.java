
package lambda.utils.PricingHealth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import lombok.Data;

import javax.annotation.Generated;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@Generated("jsonschema2pojo")
public class PricingHealthNotification {

    /**
     * The notification version. This controls the structure of the notification
     * (Required)
     */
    @JsonProperty("notificationVersion")
    @JsonPropertyDescription("The notification version. This controls the structure of the notification")
    public String notificationVersion;
    /**
     * The notification type. Combined with payload version controls the structure of payload object
     * (Required)
     */
    @JsonProperty("notificationType")
    @JsonPropertyDescription("The notification type. Combined with payload version controls the structure of payload object")
    public String notificationType;
    /**
     * The payload version. Combined with notification type controls the structure of payload
     * (Required)
     */
    @JsonProperty("payloadVersion")
    @JsonPropertyDescription("The payload version. Combined with notification type controls the structure of payload")
    public String payloadVersion;
    /**
     * The date and time (in UTC) that the event which triggered the notification occurred
     * (Required)
     */
    @JsonProperty("eventTime")
    @JsonPropertyDescription("The date and time (in UTC) that the event which triggered the notification occurred")
    public String eventTime;
    /**
     * (Required)
     */
    @JsonProperty("payload")
    public PricingHealthNotificationPayload pricingHealthNotificationPayload;
    /**
     * (Required)
     */
    @JsonProperty("notificationMetadata")
    public NotificationMetadata notificationMetadata;

}
