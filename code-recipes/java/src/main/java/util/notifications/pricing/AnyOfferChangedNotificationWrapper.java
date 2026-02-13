package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * The root schema comprises the entire JSON document.
 */
public class AnyOfferChangedNotificationWrapper {
    @SerializedName("EventTime")
    private String eventTime;
    @SerializedName("NotificationMetadata")
    private NotificationMetadata notificationMetadata;
    @SerializedName("NotificationType")
    private String notificationType;
    @SerializedName("NotificationVersion")
    private String notificationVersion;
    @SerializedName("Payload")
    private Payload payload;
    @SerializedName("PayloadVersion")
    private String payloadVersion;

    public String getEventTime() { return eventTime; }

    public NotificationMetadata getNotificationMetadata() { return notificationMetadata; }

    public String getNotificationType() { return notificationType; }

    public String getNotificationVersion() { return notificationVersion; }

    public Payload getPayload() { return payload; }

    public String getPayloadVersion() { return payloadVersion; }
}