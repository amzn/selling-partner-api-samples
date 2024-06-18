package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import lombok.Data;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationPayload {

    @JsonProperty("notificationVersion")
    private String notificationVersion;

    @JsonProperty("notificationType")
    private String notificationType;

    @JsonProperty("payload")
    private Payload payload;

    @JsonProperty("notificationMetadata")
    private NotificationMetadata notificationMetadata;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Payload {
        @JsonProperty("applicationOAuthClientSecretExpiry")
        private ApplicationOAuthClientSecretExpiry applicationOAuthClientSecretExpiry;

        @JsonProperty("applicationOAuthClientNewSecret")
        private ApplicationOAuthClientNewSecret applicationOAuthClientNewSecret;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ApplicationOAuthClientSecretExpiry {
        @JsonProperty("clientId")
        private String clientId;

        @JsonDeserialize(using = OffsetDateTimeDeserializer.class)
        @JsonProperty("clientSecretExpiryTime")
        private OffsetDateTime clientSecretExpiryTime;

        @JsonProperty("clientSecretExpiryReason")
        private String clientSecretExpiryReason;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ApplicationOAuthClientNewSecret {
        @JsonProperty("clientId")
        private String clientId;

        @JsonProperty("newClientSecret")
        private String newClientSecret;

        @JsonDeserialize(using = OffsetDateTimeDeserializer.class)
        @JsonProperty("newClientSecretExpiryTime")
        private OffsetDateTime newClientSecretExpiryTime;

        @JsonDeserialize(using = OffsetDateTimeDeserializer.class)
        @JsonProperty("oldClientSecretExpiryTime")
        private OffsetDateTime oldClientSecretExpiryTime;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NotificationMetadata {
        @JsonProperty("applicationId")
        private String applicationId;

        @JsonProperty("subscriptionId")
        private String subscriptionId;

        @JsonDeserialize(using = OffsetDateTimeDeserializer.class)
        @JsonProperty("publishTime")
        private OffsetDateTime publishTime;

        @JsonProperty("notificationId")
        private String notificationId;
    }

    private static class OffsetDateTimeDeserializer extends JsonDeserializer<OffsetDateTime> {
        @Override
        public OffsetDateTime deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            String dateTimeString = parser.getValueAsString();
            return OffsetDateTime.parse(dateTimeString, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        }
    }
}