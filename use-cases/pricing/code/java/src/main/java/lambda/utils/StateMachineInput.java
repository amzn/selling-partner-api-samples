package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class StateMachineInput {

    @JsonProperty("asin")
    public String asin;

    @JsonProperty("buyBox")
    public BuyBoxOffer buyBox;

    @JsonProperty("seller")
    public Seller seller;

    @JsonProperty("credentials")
    public ApiCredentials credentials;
}
