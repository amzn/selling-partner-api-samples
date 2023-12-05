package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;

@Builder
public class CreateOrderStateMachineInput {

    @JsonProperty("createFulfillmentOrderNotification")
    public CreateFulfillmentOrderNotification createFulfillmentOrderNotification;

    @JsonProperty("refreshToken")
    public String refreshToken;

    @JsonProperty("regionCode")
    public String regionCode;
}
