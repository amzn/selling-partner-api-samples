package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class MCFCancelOrderLambdaInput {

    @JsonProperty("cancelFulfillmentOrderNotification")
    public CancelFulfillmentOrderNotification cancelFulfillmentOrderNotification;

    @JsonProperty("refreshToken")
    public String refreshToken;

    @JsonProperty("regionCode")
    public String regionCode;
}
