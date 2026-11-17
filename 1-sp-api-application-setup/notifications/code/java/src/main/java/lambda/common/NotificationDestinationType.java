package lambda.common;

public enum NotificationDestinationType {
    AWS_SQS,
    AWS_EVENTBRIDGE,
    GCP_PUBSUB,
    AZURE_STORAGE_QUEUE,
    AZURE_SERVICE_BUS;

    public static NotificationDestinationType fromString(String value) {
        for (NotificationDestinationType type : values()) {
            if (type.name().equalsIgnoreCase(value)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Invalid destination type: " + value);
    }
}
