package util.notifications.datakiosk;

import com.google.gson.annotations.SerializedName;

/**
 * This notification is delivered when a Data Kiosk query finishes processing.
 */
public class DataKioskQueryProcessingFinishedNotification {
    @SerializedName("eventTime")
    private String eventTime;
    @SerializedName("notificationMetadata")
    private NotificationMetadata notificationMetadata;
    @SerializedName("notificationType")
    private String notificationType;
    @SerializedName("notificationVersion")
    private String notificationVersion;
    @SerializedName("payload")
    private Payload payload;
    @SerializedName("payloadVersion")
    private String payloadVersion;

    /**
     * The time the notification was sent in ISO 8601 format.
     */
    public String getEventTime() { return eventTime; }
    public void setEventTime(String value) { this.eventTime = value; }

    /**
     * The notification's metadata.
     */
    public NotificationMetadata getNotificationMetadata() { return notificationMetadata; }
    public void setNotificationMetadata(NotificationMetadata value) { this.notificationMetadata = value; }

    /**
     * The notification type.
     */
    public String getNotificationType() { return notificationType; }
    public void setNotificationType(String value) { this.notificationType = value; }

    /**
     * The notification version.
     */
    public String getNotificationVersion() { return notificationVersion; }
    public void setNotificationVersion(String value) { this.notificationVersion = value; }

    /**
     * The Data Kiosk query processing notification payload.
     */
    public Payload getPayload() { return payload; }
    public void setPayload(Payload value) { this.payload = value; }

    /**
     * The payload version of the notification.
     */
    public String getPayloadVersion() { return payloadVersion; }
    public void setPayloadVersion(String value) { this.payloadVersion = value; }
}

