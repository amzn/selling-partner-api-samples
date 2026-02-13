package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class NotificationMetadata {
    @SerializedName("ApplicationId")
    private String applicationid;
    
    @SerializedName("NotificationId")
    private String notificationid;
    
    @SerializedName("PublishTime")
    private String publishTime;
    
    @SerializedName("SubscriptionId")
    private String subscriptionid;

    public String getApplicationid() {
        return applicationid;
    }

    public String getNotificationid() {
        return notificationid;
    }

    public String getPublishTime() {
        return publishTime;
    }

    public String getSubscriptionid() {
        return subscriptionid;
    }
}
