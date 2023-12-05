package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;

@Builder
public class CancelOrderStateMachineInput {

    @JsonProperty("cancelFulfillmentOrderNotification")
    public CancelFulfillmentOrderNotification cancelFulfillmentOrderNotification;

    @JsonProperty("refreshToken")
    public String refreshToken;

    @JsonProperty("regionCode")
    public String regionCode;
}
