package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class EasyShipOrderItem {

    @JsonProperty("orderItemId")
    public String orderItemId;

    @JsonProperty("sku")
    public String sku;

    @JsonProperty("quantity")
    public Integer quantity;

    @JsonProperty("orderItemSerialNumbers")
    public List<String> orderItemSerialNumbers;
}
