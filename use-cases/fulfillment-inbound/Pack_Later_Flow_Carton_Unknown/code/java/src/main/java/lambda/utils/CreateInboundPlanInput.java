package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.client.model.fbav2024.AddressInput;
import lambda.utils.interfaces.ApiCredentialsProvider;
import lombok.*;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class CreateInboundPlanInput implements ApiCredentialsProvider {

    @JsonProperty("apiCredentials")
    public ApiCredentials apiCredentials;

    @JsonProperty("destinationMarketplace")
    public String destinationMarketplace;

    @JsonProperty("msku")
    public String msku;

    @JsonProperty("prepOwner")
    public String prepOwner;

    @JsonProperty("labelOwner")
    public String labelOwner;

    @JsonProperty("sourceAddress")
    public AddressInput sourceAddress;

    @JsonProperty("inboundPlanName")
    public String inboundPlanName;

    @Override
    public ApiCredentials getApiCredentials() {
        return apiCredentials;
    }
}
