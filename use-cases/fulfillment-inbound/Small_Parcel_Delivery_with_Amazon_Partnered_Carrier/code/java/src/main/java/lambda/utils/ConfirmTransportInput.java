package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.interfaces.ApiCredentialsProvider;
import lombok.*;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor

public class ConfirmTransportInput implements ApiCredentialsProvider {

    @JsonProperty("apiCredentials")
    public ApiCredentials apiCredentials;

    @JsonProperty("inboundPlanId")
    public String inboundPlanId;

    @JsonProperty("shipmentId")
    public String shipmentId;

    @JsonProperty("transportationOptionId")
    public String transportationOptionId;

    @Override
    public ApiCredentials getApiCredentials() {
        return apiCredentials;
    }
}
