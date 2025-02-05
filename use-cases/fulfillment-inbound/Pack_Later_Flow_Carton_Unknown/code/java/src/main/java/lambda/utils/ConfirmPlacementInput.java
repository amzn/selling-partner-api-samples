package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.interfaces.ApiCredentialsProvider;
import lombok.*;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor

public class ConfirmPlacementInput implements ApiCredentialsProvider {

    @JsonProperty("apiCredentials")
    public ApiCredentials apiCredentials;

    @JsonProperty("inboundPlanId")
    public String inboundPlanId;

    @JsonProperty("placementOptionId")
    public String placementOptionId;

    @Override
    public ApiCredentials getApiCredentials() {
        return apiCredentials;
    }
}
