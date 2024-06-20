
package lambda.utils.B2B.AOCN;

import lambda.utils.B2C.Amount;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonInclude(JsonInclude.Include.NON_NULL)

@Data
public class B2BOffer {

    @JsonProperty("sellerId")
    public String sellerId;
    @JsonProperty("subCondition")
    public String subCondition;
    @JsonProperty("sellerFeedbackRating")
    public SellerFeedbackRating sellerFeedbackRating;
    @JsonProperty("shippingTime")
    public ShippingTime shippingTime;
    @JsonProperty("listingPrice")
    public Amount listingPrice;
    @JsonProperty("quantityDiscountPrices")
    public QuantityDiscountPrices quantityDiscountPrices;
    @JsonProperty("shipping")
    public Amount shipping;
    @JsonProperty("shipsFrom")
    public ShipsFrom shipsFrom;
    @JsonProperty("isFulfilledByAmazon")
    public Boolean isFulfilledByAmazon;
    @JsonProperty("isBuyBoxWinner")
    public Boolean isBuyBoxWinner;
    @JsonProperty("conditionNotes")
    public String conditionNotes;
    @JsonProperty("primeInformation")
    public PrimeInformation primeInformation;
    @JsonProperty("isFeaturedMerchant")
    public Boolean isFeaturedMerchant;

}
