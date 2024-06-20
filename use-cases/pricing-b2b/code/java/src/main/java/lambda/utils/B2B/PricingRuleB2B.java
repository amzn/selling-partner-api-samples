package lambda.utils.B2B;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.B2C.Amount;
import lambda.utils.B2C.PriceChangeRule;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PricingRuleB2B {
    @JsonProperty("offerType")
    public String offerType;
    @JsonProperty("quantityTier")
    public float quantityTier;
    @JsonProperty("priceChangeRule")
    public String priceChangeRule;
    @JsonProperty("priceChangeRuleAmount")
    public float priceChangeRuleAmount;
    @JsonProperty("minThreshold")
    public float minThreshold;
    @JsonProperty("newListingPrice")
    public Amount newListingPrice;
    @JsonProperty("issues")
    public String issues;

}
