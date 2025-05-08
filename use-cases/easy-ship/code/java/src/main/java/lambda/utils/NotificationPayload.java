package lambda.utils;


import com.google.gson.annotations.SerializedName;
import lombok.Data;

@Data
public class NotificationPayload {

    @SerializedName("OrderChangeNotification")
    public OrderChangeNotification orderChangeNotification;
}
