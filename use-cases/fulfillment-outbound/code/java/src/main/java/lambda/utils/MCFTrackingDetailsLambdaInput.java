package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class MCFTrackingDetailsLambdaInput {

    @JsonProperty("regionCode")
    public String regionCode;

    @JsonProperty("refreshToken")
    public String refreshToken;
    
    @JsonProperty("sellerFulfillmentOrderId")
    public String sellerFulfillmentOrderId;
    
    @JsonProperty("packageNumbers")
    public List<Integer> packageNumbers;
}