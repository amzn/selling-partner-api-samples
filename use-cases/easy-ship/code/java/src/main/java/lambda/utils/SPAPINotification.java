package lambda.utils;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

import java.util.Date;

@Data
public class SPAPINotification {

    @SerializedName("NotificationType")
    public String notificationType;

    @SerializedName("EventTime")
    public Date eventTime;

    @SerializedName("Payload")
    public NotificationPayload payload;
}
