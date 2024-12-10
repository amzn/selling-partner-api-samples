package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderChangeReason {

    @JsonProperty("TimeOfOrderChange")
    public String timeOfOrderChange;

    @JsonProperty("ChangeReason")
    public String changeReason;
}
