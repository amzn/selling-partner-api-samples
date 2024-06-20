package lambda.utils.B2B;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
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
public class DynamoDBItemB2B {

    @JsonProperty("ASIN")
    public String ASIN;

    @JsonProperty("SKU")
    public String SKU;

    @JsonProperty("Condition")
    public String Condition;

    @JsonProperty("MarketPlaceId")
    public String MarketPlaceId;

    @JsonProperty("IsFulfilledByAmazon")
    public boolean IsFulfilledByAmazon;

    @JsonProperty("PriceRules")
    public List<PricingRuleB2B> PriceRules;

    @JsonProperty("SellerId")
    public String SellerId;

}
