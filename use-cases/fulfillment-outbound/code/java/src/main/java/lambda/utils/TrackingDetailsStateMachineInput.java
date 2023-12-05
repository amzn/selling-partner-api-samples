package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;

@Builder
public class TrackingDetailsStateMachineInput {

    @JsonProperty("sellerFulfillmentOrderId")
    public String sellerFulfillmentOrderId;
    
    @JsonProperty("refreshToken")
    public String refreshToken;

    @JsonProperty("regionCode")
    public String regionCode;
}
