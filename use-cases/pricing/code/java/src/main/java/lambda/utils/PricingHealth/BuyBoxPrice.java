
package lambda.utils.PricingHealth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import lombok.Data;

import javax.annotation.Generated;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@Generated("jsonschema2pojo")
public class BuyBoxPrice {

    /**
     * Indicates the condition of the item
     * (Required)
     */
    @JsonProperty("condition")
    @JsonPropertyDescription("Indicates the condition of the item")
    public String condition;
    /**
     * (Required)
     */
    @JsonProperty("landedPrice")
    public MoneyType landedPrice;
    /**
     * (Required)
     */
    @JsonProperty("listingPrice")
    public MoneyType listingPrice;
    /**
     * (Required)
     */
    @JsonProperty("shipping")
    public MoneyType shipping;
    /**
     * The number of Amazon Points offered with the purchase of an item
     */
    @JsonProperty("points")
    @JsonPropertyDescription("The number of Amazon Points offered with the purchase of an item")
    public Points points;

}
