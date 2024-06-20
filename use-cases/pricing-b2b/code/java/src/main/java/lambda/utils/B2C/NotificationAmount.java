package lambda.utils.B2C;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationAmount {

    @JsonProperty("CurrencyCode")
    public String currencyCode;

    @JsonProperty("Amount")
    public float amount;
}
