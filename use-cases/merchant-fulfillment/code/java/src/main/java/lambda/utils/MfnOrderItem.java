package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.client.model.mfn.Weight;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class MfnOrderItem {

    @JsonProperty("orderItemId")
    public String orderItemId;

    @JsonProperty("sku")
    public String sku;

    @JsonProperty("quantity")
    public Integer quantity;

    @JsonProperty("ItemWeight")
    public Weight itemWeight;
}
