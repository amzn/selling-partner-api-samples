
package lambda.utils.PricingHealth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import javax.annotation.Generated;


/**
 * A set of reference prices for the given ASIN
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@Generated("jsonschema2pojo")
public class ReferencePrice {

    @JsonProperty("averageSellingPrice")
    public MoneyType averageSellingPrice;
    @JsonProperty("competitivePriceThreshold")
    public MoneyType competitivePriceThreshold;
    @JsonProperty("retailOfferPrice")
    public MoneyType retailOfferPrice;
    @JsonProperty("msrpPrice")
    public MoneyType msrpPrice;

}
