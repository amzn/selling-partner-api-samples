package lambda.common;

import com.google.gson.annotations.SerializedName;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EventBridgeDestinationInfo {

    @SerializedName("accountId")
    private String accountId;

    @SerializedName("region")
    private String region;
}
