package lambda.utils;

import com.google.gson.annotations.SerializedName;
import lombok.Data;


@Data
public class OrderChangeNotification {

    @SerializedName("NotificationLevel")
    public String notificationLevel;

    @SerializedName("SellerId")
    public String sellerId;

    @SerializedName("AmazonOrderId")
    public String amazonOrderId;

    @SerializedName("OrderChangeTrigger")
    public OrderChangeReason orderChangeTrigger;

    @SerializedName("Summary")
    public OrderChangeSummary summary;
}
