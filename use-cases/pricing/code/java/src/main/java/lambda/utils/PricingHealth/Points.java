
package lambda.utils.PricingHealth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import javax.annotation.Generated;


/**
 * The number of Amazon Points offered with the purchase of an item
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@Generated("jsonschema2pojo")
public class Points {

    /**
     * The number of Amazon Points offered with the purchase of an item
     * (Required)
     */
    @JsonProperty("pointsNumber")
    @JsonPropertyDescription("The number of Amazon Points offered with the purchase of an item")
    public Integer pointsNumber;

}
