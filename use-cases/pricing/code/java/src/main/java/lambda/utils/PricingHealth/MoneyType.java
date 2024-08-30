
package lambda.utils.PricingHealth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import javax.annotation.Generated;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@Generated("jsonschema2pojo")
public class MoneyType {

    /**
     * (Required)
     */
    @JsonProperty("amount")
    public Double amount;
    /**
     * (Required)
     */
    @JsonProperty("currencyCode")
    public String currencyCode;

}
