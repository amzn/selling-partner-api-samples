package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.PricingHealth.ReferencePrice;
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
@JsonIgnoreProperties(ignoreUnknown = true)
public class Offer {

    @JsonProperty("listingPrice")
    public Amount listingPrice;

    @JsonProperty("shippingPrice")
    public Amount shippingPrice;

    @JsonProperty("isBuyBoxWinner")
    public boolean isBuyBoxWinner;

    @JsonProperty("isFulfilledByAmazon")
    public boolean isFulfilledByAmazon;

    @JsonProperty("referencePrice")
    public ReferencePrice referencePrice;
}
