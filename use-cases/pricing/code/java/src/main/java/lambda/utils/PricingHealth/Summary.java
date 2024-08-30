
package lambda.utils.PricingHealth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import lombok.Data;

import javax.annotation.Generated;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@Generated("jsonschema2pojo")
public class Summary {

    /**
     * A list that contains the total number of offers for the item for the given conditions and fulfillment channels
     * (Required)
     */
    @JsonProperty("numberOfOffers")
    @JsonPropertyDescription("A list that contains the total number of offers for the item for the given conditions and fulfillment channels")
    public List<OfferCount> numberOfOffers;
    /**
     * A list that contains the total number of offers that are eligible for the Buy Box for the given conditions and fulfillment channels
     * (Required)
     */
    @JsonProperty("buyBoxEligibleOffers")
    @JsonPropertyDescription("A list that contains the total number of offers that are eligible for the Buy Box for the given conditions and fulfillment channels")
    public List<OfferCount> buyBoxEligibleOffers;
    /**
     * A list that contains the Buy Box price of the item for the given conditions
     */
    @JsonProperty("buyBoxPrices")
    @JsonPropertyDescription("A list that contains the Buy Box price of the item for the given conditions")
    public List<BuyBoxPrice> buyBoxPrices;
    /**
     * A list that contains the sales rankings of the asin in various product categories
     */
    @JsonProperty("salesRankings")
    @JsonPropertyDescription("A list that contains the sales rankings of the asin in various product categories")
    public List<SalesRank> salesRankings;
    /**
     * A set of reference prices for the given ASIN
     * (Required)
     */
    @JsonProperty("referencePrice")
    @JsonPropertyDescription("A set of reference prices for the given ASIN")
    public ReferencePrice referencePrice;

}
