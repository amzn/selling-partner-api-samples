package lambda.utils;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

@Data
public class OrderChangeReason {

    @SerializedName("TimeOfOrderChange")
    public String timeOfOrderChange;

    @SerializedName("ChangeReason")
    public String changeReason;
}
