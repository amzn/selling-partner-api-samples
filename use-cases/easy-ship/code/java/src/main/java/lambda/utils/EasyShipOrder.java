package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.client.model.easyship.Weight;
import io.swagger.client.model.easyship.Dimensions;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class EasyShipOrder {

    @JsonProperty("orderItems")
    public List<EasyShipOrderItem> orderItems;

    @JsonProperty("packageDimensions")
    public Dimensions packageDimensions;

    @JsonProperty("weight")
    public Weight packageWeight;
}
