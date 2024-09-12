
package lambda.utils.PricingHealth;

import javax.annotation.Generated;

import com.fasterxml.jackson.annotation.*;
import lombok.Data;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@Generated("jsonschema2pojo")
public class SalesRank {

    /**
     * The product category for the rank
     * (Required)
     * 
     */
    @JsonProperty("productCategoryId")
    @JsonPropertyDescription("The product category for the rank")
    public String productCategoryId;
    /**
     * The sales rank of the ASIN
     * (Required)
     * 
     */
    @JsonProperty("rank")
    @JsonPropertyDescription("The sales rank of the ASIN")
    public Integer rank;

}
