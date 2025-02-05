package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.interfaces.ApiCredentialsProvider;
import lombok.*;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor

public class GetLabelsInput implements ApiCredentialsProvider {

    @JsonProperty("apiCredentials")
    public ApiCredentials apiCredentials;

    @JsonProperty("inboundPlanId")
    public String inboundPlanId;

    @JsonProperty("shipmentConfirmationId")
    public String shipmentConfirmationId;

    @JsonProperty("PageType")
    public String PageType;

    @JsonProperty("PageSize")
    public Integer PageSize;

    @JsonProperty("LabelType")
    public String LabelType;

    @JsonProperty("NumberOfPallets")
    public Integer NumberOfPallets;

    @Override
    public ApiCredentials getApiCredentials() {
        return apiCredentials;
    }
}
