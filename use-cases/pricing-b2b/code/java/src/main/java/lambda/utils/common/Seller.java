package lambda.utils.common;

import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.B2C.Offer;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Seller {

    @JsonProperty("sellerId")
    public String sellerId;

    @JsonProperty("offers")
    public List<Offer> offers;
}
