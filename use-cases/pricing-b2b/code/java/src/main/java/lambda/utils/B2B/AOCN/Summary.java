
package lambda.utils.B2B.AOCN;

import java.util.List;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "numberOfOffers",
    "buyBoxEligibleOffers",
    "lowestPrices",
    "buyBoxPrices"
})
@Data
public class Summary {

    @JsonProperty("numberOfOffers")
    public List<NumberOfOffer> numberOfOffers;
    @JsonProperty("buyBoxEligibleOffers")
    public List<BuyBoxEligibleOffer> buyBoxEligibleOffers;
    @JsonProperty("lowestPrices")
    public List<BuyBoxB2B> lowestPrices;
    @JsonProperty("buyBoxPrices")
    public List<BuyBoxB2B> buyBoxPrices;

}
