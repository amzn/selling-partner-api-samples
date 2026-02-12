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

    public void setApplicationid(String value) {
        this.applicationid = value;
    }

    /**
     * The notification identifier.
     */
    public String getNotificationid() {
        return notificationid;
    }

    public void setNotificationid(String value) {
        this.notificationid = value;
    }

    /**
     * The time the notification was published in ISO 8601 format.
     */
    @SerializedName("publishTime")
    public String getPublishTime() {
        return publishTime;
    }

    public void setPublishTime(String value) {
        this.publishTime = value;
    }

    /**
     * The subscription identifier.
     */
    public String getSubscriptionid() {
        return subscriptionid;
    }

    public void setSubscriptionid(String value) {
        this.subscriptionid = value;
    }
}
