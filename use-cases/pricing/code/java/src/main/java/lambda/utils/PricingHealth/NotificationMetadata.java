
package lambda.utils.PricingHealth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import lombok.Data;

import javax.annotation.Generated;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@Generated("jsonschema2pojo")
public class NotificationMetadata {

    /**
     * The identifier for the application that uses the notifications
     * (Required)
     */
    @JsonProperty("applicationId")
    @JsonPropertyDescription("The identifier for the application that uses the notifications")
    public String applicationId;
    /**
     * A unique identifier for the subscription which resulted in this notification
     * (Required)
     */
    @JsonProperty("subscriptionId")
    @JsonPropertyDescription("A unique identifier for the subscription which resulted in this notification")
    public String subscriptionId;
    /**
     * The date and time (in UTC) that the notification was sent
     * (Required)
     */
    @JsonProperty("publishTime")
    @JsonPropertyDescription("The date and time (in UTC) that the notification was sent")
    public String publishTime;
    /**
     * A unique identifier for this notification instance
     * (Required)
     */
    @JsonProperty("notificationId")
    @JsonPropertyDescription("A unique identifier for this notification instance")
    public String notificationId;

}
