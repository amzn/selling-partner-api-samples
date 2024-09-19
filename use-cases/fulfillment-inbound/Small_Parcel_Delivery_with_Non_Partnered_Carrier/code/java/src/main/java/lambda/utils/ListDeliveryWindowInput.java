package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.interfaces.ApiCredentialsProvider;
import lombok.*;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor

public class ListDeliveryWindowInput implements ApiCredentialsProvider {

    @JsonProperty("apiCredentials")
    private ApiCredentials apiCredentials;

    @JsonProperty("inboundPlanId")
    private String inboundPlanId;

    @JsonProperty("shipmentId")
    public String shipmentId;

    @Override
    public ApiCredentials getApiCredentials() {
        return apiCredentials;
    }
}