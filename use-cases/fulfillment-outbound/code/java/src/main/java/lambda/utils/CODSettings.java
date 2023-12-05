package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class CODSettings {

    @JsonProperty("isCodRequired")
    public boolean isCodRequired;

    @JsonProperty("codCharge")
    public Money codCharge;
    
    @JsonProperty("codChargeTax")
    public Money codChargeTax;
    
    @JsonProperty("shippingCharge")
    public Money shippingCharge;
    
    @JsonProperty("shippingChargeTax")
    public Money shippingChargeTax;
}