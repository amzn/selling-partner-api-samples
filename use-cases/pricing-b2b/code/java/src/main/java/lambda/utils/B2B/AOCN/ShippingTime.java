
package lambda.utils.B2B.AOCN;

import lombok.Data;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "minimumHours",
    "maximumHours",
    "availabilityType",
    "availableDate"
})
@Data
public class ShippingTime {

    @JsonProperty("minimumHours")
    public Long minimumHours;
    @JsonProperty("maximumHours")
    public Long maximumHours;
    @JsonProperty("availabilityType")
    public String availabilityType;
    @JsonProperty("availableDate")
    public String availableDate;

}
