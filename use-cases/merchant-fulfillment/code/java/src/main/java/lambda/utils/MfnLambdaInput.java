package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.client.model.mfn.Label;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class MfnLambdaInput {

    @JsonProperty("regionCode")
    public String regionCode;

    @JsonProperty("refreshToken")
    public String refreshToken;

    @JsonProperty("orderId")
    public String orderId;

    @JsonProperty("mfnOrder")
    public MfnOrder mfnOrder;

    @JsonProperty("label")
    public Label label;
}
