package lambda.utils.B2C;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OfferChangeTrigger {

    @JsonProperty("ASIN")
    public String asin;

    @JsonProperty("MarketplaceId")
    public String marketplaceId;

    @JsonProperty("OfferChangeType")
    public String offerChangeType;
}
