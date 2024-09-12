
package lambda.utils.PricingHealth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import lombok.Data;

import javax.annotation.Generated;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@Generated("jsonschema2pojo")
public class OfferCount {

    /**
     * Indicates the condition of the item
     * (Required)
     */
    @JsonProperty("condition")
    @JsonPropertyDescription("Indicates the condition of the item")
    public String condition;
    /**
     * Indicates whether the item is fulfilled by Amazon or by the seller
     * (Required)
     */
    @JsonProperty("fulfillmentType")
    @JsonPropertyDescription("Indicates whether the item is fulfilled by Amazon or by the seller")
    public MerchantOffer.FulfillmentType fulfillmentType;
    /**
     * The total number of offers for the specified condition and fulfillment channel
     * (Required)
     */
    @JsonProperty("offerCount")
    @JsonPropertyDescription("The total number of offers for the specified condition and fulfillment channel")
    public Integer offerCount;

}
