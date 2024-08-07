package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.interfaces.ApiCredentialsProvider;
import lombok.*;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class GenerateTransportationInput implements ApiCredentialsProvider {

    @JsonProperty("apiCredentials")
    private ApiCredentials apiCredentials;

    @JsonProperty("inboundPlanId")
    private String inboundPlanId;

    @JsonProperty("placementOptionId")
    private String placementOptionId;

    @JsonProperty("shipmentId")
    private String shipmentId;

    @JsonProperty("readyToShipWindow")
    private String readyToShipWindow;

    @Override
    public ApiCredentials getApiCredentials() {
        return apiCredentials;
    }
}