package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.interfaces.ApiCredentialsProvider;
import lombok.*;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor

public class UpdateShipmentTrackingInput implements ApiCredentialsProvider {

    @JsonProperty("apiCredentials")
    private ApiCredentials apiCredentials;

    @JsonProperty("inboundPlanId")
    private String inboundPlanId;

    @JsonProperty("shipmentId")
    private String shipmentId;

    @JsonProperty("freightBillNumber")
    private String freightBillNumber;

    @Override
    public ApiCredentials getApiCredentials() {
        return apiCredentials;
    }
}