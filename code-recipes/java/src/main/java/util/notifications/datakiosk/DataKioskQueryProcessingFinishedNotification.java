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

    /**
     * The notification's metadata.
     */
    public NotificationMetadata getNotificationMetadata() { return notificationMetadata; }

    /**
     * The notification type.
     */
    public String getNotificationType() { return notificationType; }

    /**
     * The notification version.
     */
    public String getNotificationVersion() { return notificationVersion; }

    /**
     * The Data Kiosk query processing notification payload.
     */
    public Payload getPayload() { return payload; }

    /**
     * The payload version of the notification.
     */
    public String getPayloadVersion() { return payloadVersion; }
}

