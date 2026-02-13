package util.notifications.datakiosk;

import com.google.gson.annotations.SerializedName;

/**
 * The notification's metadata.
 */
public class NotificationMetadata {
    @SerializedName("applicationId")
    private String applicationid;
    @SerializedName("notificationId")
    private String notificationid;
    @SerializedName("publishTime")
    private String publishTime;
    @SerializedName("subscriptionId")
    private String subscriptionid;

    /**
     * The application identifier.
     */
    public String getApplicationid() {
        return applicationid;
    }

    /**
     * The notification identifier.
     */
    public String getNotificationid() {
        return notificationid;
    }

    /**
     * The time the notification was published in ISO 8601 format.
     */
    @SerializedName("publishTime")
    public String getPublishTime() {
        return publishTime;
    }

    /**
     * The subscription identifier.
     */
    public String getSubscriptionid() {
        return subscriptionid;
    }
}
