package lambda.utils.B2B;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.B2C.PricingLambdaInput;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class PricingOffersB2B {

    @JsonProperty("offers")
    public List<PricingLambdaInputB2B> offers;
}
