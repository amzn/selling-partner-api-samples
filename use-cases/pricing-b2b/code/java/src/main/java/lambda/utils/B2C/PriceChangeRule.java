package lambda.utils.B2C;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PriceChangeRule {

    @JsonProperty("rule")
    public String rule;

    @JsonProperty("value")
    public float value;
}
