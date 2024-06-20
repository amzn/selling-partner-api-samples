package lambda.utils.B2C;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AnyOfferChangedNotification {

    @JsonProperty("SellerId")
    public String sellerId;

    @JsonProperty("OfferChangeTrigger")
    public OfferChangeTrigger offerChangeTrigger;

    @JsonProperty("Summary")
    public AnyOfferChangedSummary summary;

    @JsonProperty("Offers")
    public List<NotificationOffer> offers;
}
