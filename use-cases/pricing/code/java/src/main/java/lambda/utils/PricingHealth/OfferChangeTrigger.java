
package lambda.utils.PricingHealth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import lombok.Data;

import javax.annotation.Generated;


/**
 * The event that caused the notification to be sent
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@Generated("jsonschema2pojo")
public class OfferChangeTrigger {

    /**
     * The marketplace identifier of the item that had an offer change
     * (Required)
     */
    @JsonProperty("marketplaceId")
    @JsonPropertyDescription("The marketplace identifier of the item that had an offer change")
    public String marketplaceId;
    /**
     * The asin for the item that had an offer change
     * (Required)
     */
    @JsonProperty("asin")
    @JsonPropertyDescription("The asin for the item that had an offer change")
    public String asin;
    /**
     * The condition of the item that had an offer change
     * (Required)
     */
    @JsonProperty("itemCondition")
    @JsonPropertyDescription("The condition of the item that had an offer change")
    public String itemCondition;
    /**
     * The update time for the offer that caused this notification
     * (Required)
     */
    @JsonProperty("timeOfOfferChange")
    @JsonPropertyDescription("The update time for the offer that caused this notification")
    public String timeOfOfferChange;

}
