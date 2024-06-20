
package lambda.utils.B2B.AOCN;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Data;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "condition",
    "fulfillmentChannel",
    "offerCount"
})
@Data
public class BuyBoxEligibleOffer {

    @JsonProperty("condition")
    public String condition;
    @JsonProperty("fulfillmentChannel")
    public String fulfillmentChannel;
    @JsonProperty("offerCount")
    public Long offerCount;

}
