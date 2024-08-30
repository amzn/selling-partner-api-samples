package lambda.utils.AnyOfferChanged;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationPrice {

    @JsonProperty("Condition")
    public String condition;

    @JsonProperty("LandedPrice")
    public NotificationAmount landedPrice;
}
