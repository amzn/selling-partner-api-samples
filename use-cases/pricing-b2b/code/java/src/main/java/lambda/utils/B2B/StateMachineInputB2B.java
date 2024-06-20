package lambda.utils.B2B;

import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.B2B.AOCN.BuyBoxB2B;
import lambda.utils.common.ApiCredentials;
import lambda.utils.common.Seller;
import lombok.*;

import java.util.List;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class StateMachineInputB2B {

    @JsonProperty("asin")
    public String asin;

    @JsonProperty("buyBox")
    public List<BuyBoxB2B> buyBox;  // buybox price from notifications

    @JsonProperty("seller")
    public Seller seller;

    @JsonProperty("credentials")
    public ApiCredentials credentials;
}
