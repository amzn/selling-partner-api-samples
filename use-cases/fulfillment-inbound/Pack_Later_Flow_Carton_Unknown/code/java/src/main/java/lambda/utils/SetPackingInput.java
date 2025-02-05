package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.client.model.fbav2024.Dimensions;
import io.swagger.client.model.fbav2024.Weight;
import lambda.utils.interfaces.ApiCredentialsProvider;
import lombok.*;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class SetPackingInput implements ApiCredentialsProvider {

    @JsonProperty("apiCredentials")
    public ApiCredentials apiCredentials;

    @JsonProperty("inboundPlanId")
    public String inboundPlanId;

    @JsonProperty("msku")
    public String msku;

    @JsonProperty("prepOwner")
    public String prepOwner;

    @JsonProperty("labelOwner")
    public String labelOwner;

    @JsonProperty("shipmentId")
    public String shipmentId;

    @JsonProperty("boxDimensions")
    public Dimensions boxDimensions;

    @JsonProperty("boxWeight")
    public Weight boxWeight;

    @Override
    public ApiCredentials getApiCredentials() {
        return apiCredentials;
    }
}