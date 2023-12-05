package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class MCFCreateOrderLambdaInput {

    @JsonProperty("regionCode")
    public String regionCode;

    @JsonProperty("refreshToken")
    public String refreshToken;

    @JsonProperty("createFulfillmentOrderNotification")
    public CreateFulfillmentOrderNotification createFulfillmentOrderNotification;

}
