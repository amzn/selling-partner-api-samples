package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;

@Builder
public class StateMachineInput {

    @JsonProperty("orderId")
    public String orderId;

    @JsonProperty("refreshToken")
    public String refreshToken;

    @JsonProperty("regionCode")
    public String regionCode;
}
