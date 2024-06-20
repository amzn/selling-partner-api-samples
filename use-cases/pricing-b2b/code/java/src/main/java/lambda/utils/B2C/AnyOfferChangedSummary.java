package lambda.utils.B2C;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AnyOfferChangedSummary {

    @JsonProperty("BuyBoxPrices")
    public List<NotificationPrice> buyBoxPrices;
}
