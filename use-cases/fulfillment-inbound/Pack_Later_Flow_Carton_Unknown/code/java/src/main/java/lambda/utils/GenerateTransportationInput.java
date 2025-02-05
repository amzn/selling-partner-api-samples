package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.client.model.fbav2024.*;
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

    @JsonProperty("contactInformation")
    public ContactInformation contactInformation;

    @JsonProperty("freightInformation")
    public FreightInformation freightInformation;

    @JsonProperty("palletDimensions")
    public Dimensions palletDimensions;

    @JsonProperty("stackability")
    public Stackability stackability;

    @JsonProperty("palletWeight")
    public Weight palletWeight;

    @Override
    public ApiCredentials getApiCredentials() {
        return apiCredentials;
    }
}