package lambda.utils.B2B.AOCN;

import lambda.utils.B2C.Amount;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class QuantityDiscountPrices {
    @JsonProperty("quantityTier")
    public float quantityTier;
    @JsonProperty("quantityDiscountType")
    public String quantityDiscountType;
    @JsonProperty("price")
    public Amount price;
    @JsonProperty("listingPrice")
    public Amount listingPrice;

}
