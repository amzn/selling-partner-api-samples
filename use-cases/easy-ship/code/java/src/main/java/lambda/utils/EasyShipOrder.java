package lambda.utils;

import com.google.gson.annotations.SerializedName;
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

    @SerializedName("orderItems")
    public List<EasyShipOrderItem> orderItems;

    @SerializedName("packageDimensions")
    public Dimensions packageDimensions;

    @SerializedName("weight")
    public Weight packageWeight;
}
