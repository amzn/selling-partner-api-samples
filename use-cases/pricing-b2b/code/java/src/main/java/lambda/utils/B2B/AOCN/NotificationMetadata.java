
package lambda.utils.B2B.AOCN;

import lombok.Data;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "applicationId",
    "subscriptionId",
    "publishTime",
    "notificationId"
})
@Data
public class NotificationMetadata {

    @JsonProperty("applicationId")
    public String applicationId;
    @JsonProperty("subscriptionId")
    public String subscriptionId;
    @JsonProperty("publishTime")
    public String publishTime;
    @JsonProperty("notificationId")
    public String notificationId;

}
