
package lambda.utils.B2B.AOCN;

import lombok.Data;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "marketplaceId",
    "asin",
    "itemCondition",
    "timeOfOfferChange"
})
@Data
public class OfferChangeTriggerB2B {

    @JsonProperty("marketplaceId")
    public String marketplaceId;
    @JsonProperty("asin")
    public String asin;
    @JsonProperty("itemCondition")
    public String itemCondition;
    @JsonProperty("timeOfOfferChange")
    public String timeOfOfferChange;

}
