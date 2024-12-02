package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.client.model.easyship.ScheduledPackageId;
import io.swagger.client.model.easyship.TimeSlots;
import lambda.utils.interfaces.ApiCredentialsProvider;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class StateMachineInput implements ApiCredentialsProvider {

    @JsonProperty("apiCredentials")
    public ApiCredentials apiCredentials;

    @JsonProperty("amazonOrderId")
    public String amazonOrderId;

    @JsonProperty("marketplaceId")
    public String marketplaceId;

    @JsonProperty("sellerId")
    public String sellerId;

    @JsonProperty("easyShipOrder")
    public EasyShipOrder easyShipOrder;

    @JsonProperty("timeSlots")
    public TimeSlots timeSlots;

    @JsonProperty("scheduledPackageId")
    public ScheduledPackageId scheduledPackageId;

    @JsonProperty("feedId")
    public String feedId;

    @JsonProperty("reportId")
    public String reportId;

    @JsonProperty("labelUri")
    public String labelUri;
}
