package util.notifications.datakiosk;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonDeserializer;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;

public class DataKioskNotificationConverter {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = new DateTimeFormatterBuilder()
            .appendOptional(DateTimeFormatter.ISO_DATE_TIME)
            .appendOptional(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
            .appendOptional(DateTimeFormatter.ISO_INSTANT)
            .appendOptional(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SX"))
            .appendOptional(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ssX"))
            .appendOptional(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
            .toFormatter()
            .withZone(ZoneOffset.UTC);

    public static OffsetDateTime parseDateTimeString(String str) {
        return ZonedDateTime.from(DataKioskNotificationConverter.DATE_TIME_FORMATTER.parse(str)).toOffsetDateTime();
    }

    public static DataKioskQueryProcessingFinishedNotification fromJsonString(String json) {
        return getGson().fromJson(json, DataKioskQueryProcessingFinishedNotification.class);
    }

    private static Gson gson;

    private static void instantiateGson() {
        gson = new GsonBuilder()
                .registerTypeAdapter(OffsetDateTime.class, (JsonDeserializer<OffsetDateTime>) (json, type, context) -> 
                        parseDateTimeString(json.getAsString()))
                .create();
    }

    private static Gson getGson() {
        if (gson == null) instantiateGson();
        return gson;
    }
}
