package lambda.utils.B2C;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class BuyBoxOffer {

    @JsonProperty("condition")
    public String condition;

    @JsonProperty("price")
    public Amount price;
}
