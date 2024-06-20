package lambda.utils.B2B;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.B2B.AOCN.B2BOffer;
import lambda.utils.B2B.AOCN.BuyBoxB2B;
import lambda.utils.B2C.Amount;
import lambda.utils.B2C.Offer;
import lambda.utils.B2C.PriceChangeRule;
import lambda.utils.common.ApiCredentials;
import lambda.utils.common.Seller;
import lombok.*;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PricingLambdaInputB2B {

    @JsonProperty("sellerId")
    public String sellerId;

    @JsonProperty("asin")
    public String asin;

    @JsonProperty("itemSku")
    public String itemSku;

    @JsonProperty("isFulfilledByAmazon")
    public boolean isFulfilledByAmazon;

    @JsonProperty("buyBox")
    public List<BuyBoxB2B> buyBox; // buybox prices from notifications
    @JsonProperty("pricingRules")
    public List<PricingRuleB2B> pricingRules;
    @JsonProperty("credentials")
    public ApiCredentials credentials;

    @JsonProperty("seller")
    public Seller seller;
    @JsonProperty("sellerOffer")
    public Offer sellerOffer;

    @JsonProperty("issues")
    public String issues;
    @JsonProperty("newListingPrice")
    public Amount newListingPrice;

    @JsonProperty("feedDetails")
    public FeedDetails feedDetails;

}
