
package lambda.utils.B2B.AOCN;

import lombok.Data;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "condition",
    "fulfillmentChannel",
    "offerCount"
})
@Data
public class NumberOfOffer {

    @JsonProperty("condition")
    public String condition;
    @JsonProperty("fulfillmentChannel")
    public String fulfillmentChannel;
    @JsonProperty("offerCount")
    public Long offerCount;

}
