package lambda.utils;

import com.google.gson.annotations.SerializedName;
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

    @SerializedName("apiCredentials")
    public ApiCredentials apiCredentials;

    @SerializedName("amazonOrderId")
    public String amazonOrderId;

    @SerializedName("marketplaceId")
    public String marketplaceId;

    @SerializedName("sellerId")
    public String sellerId;

    @SerializedName("easyShipOrder")
    public EasyShipOrder easyShipOrder;

    @SerializedName("timeSlots")
    public TimeSlots timeSlots;

    @SerializedName("scheduledPackageId")
    public ScheduledPackageId scheduledPackageId;

    @SerializedName("feedId")
    public String feedId;

    @SerializedName("reportId")
    public String reportId;

    @SerializedName("labelUri")
    public String labelUri;
}
