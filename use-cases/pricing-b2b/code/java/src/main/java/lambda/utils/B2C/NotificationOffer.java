package lambda.utils.B2C;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationOffer {

    @JsonProperty("SellerId")
    public String sellerId;

    @JsonProperty("ListingPrice")
    public NotificationAmount listingPrice;

    @JsonProperty("Shipping")
    public NotificationAmount shippingPrice;

    @JsonProperty("IsBuyBoxWinner")
    public boolean isBuyBoxWinner;

    @JsonProperty("IsFulfilledByAmazon")
    public boolean isFulfilledByAmazon;
}
