package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class DeliveryWindow {

    @JsonProperty("startDate")
    public String startDate;

    @JsonProperty("endDate")
    public String endDate;
}