package lambda.utils;

import com.google.gson.annotations.SerializedName;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class EasyShipOrderItem {

    @SerializedName("orderItemId")
    public String orderItemId;

    @SerializedName("sku")
    public String sku;

    @SerializedName("quantity")
    public Integer quantity;

    @SerializedName("orderItemSerialNumbers")
    public List<String> orderItemSerialNumbers;
}
