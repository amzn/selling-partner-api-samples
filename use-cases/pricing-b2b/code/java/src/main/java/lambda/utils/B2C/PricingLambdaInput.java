package lambda.utils.B2C;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.common.ApiCredentials;
import lambda.utils.common.Seller;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PricingLambdaInput {

    @JsonProperty("sellerId")
    public String sellerId;

    @JsonProperty("asin")
    public String asin;

    @JsonProperty("itemSku")
    public String itemSku;

    @JsonProperty("listingPrice")
    public Amount listingPrice;

    @JsonProperty("shippingPrice")
    public Amount shippingPrice;

    @JsonProperty("isFulfilledByAmazon")
    public boolean isFulfilledByAmazon;

    @JsonProperty("isBuyBoxWinner")
    public boolean isBuyBoxWinner;

    @JsonProperty("buyBox")
    public BuyBoxOffer buyBox;

    @JsonProperty("priceChangeRule")
    public PriceChangeRule priceChangeRule;

    @JsonProperty("minThreshold")
    public float minThreshold;

    @JsonProperty("newListingPrice")
    public Amount newListingPrice;

    @JsonProperty("credentials")
    public ApiCredentials credentials;

    @JsonProperty("seller")
    public Seller seller;

    @JsonProperty("sellerOffer")
    public Offer sellerOffer;

    @JsonProperty("issues")
    public String issues;
}
