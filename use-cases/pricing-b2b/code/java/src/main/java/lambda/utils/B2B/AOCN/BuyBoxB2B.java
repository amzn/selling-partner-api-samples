
package lambda.utils.B2B.AOCN;

import lambda.utils.B2C.Amount;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "condition",
    "fulfillmentChannel",
    "offerType",
    "quantityTier",
    "listingPrice",
    "shipping",
    "landedPrice",
    "discountType"
})
@Data
public class BuyBoxB2B {

    @JsonProperty("condition")
    public String condition;
    @JsonProperty("fulfillmentChannel")
    public String fulfillmentChannel;
    @JsonProperty("offerType")
    public String offerType;
    @JsonProperty("quantityTier")
    public Long quantityTier;
    @JsonProperty("listingPrice")
    public Amount listingPrice;
    @JsonProperty("shipping")
    public Amount shipping;
    @JsonProperty("landedPrice")
    public Amount landedPrice;
    @JsonProperty("discountType")
    public String discountType;

}
