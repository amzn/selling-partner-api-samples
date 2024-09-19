package lambda.utils.enums;

import lombok.Getter;

@Getter
public enum TransportationResponseKey {
    TRANSPORTATION_OPTION_ID("transportationOptionId"),
    ERROR("error");

    private final String key;

    TransportationResponseKey(String key) {
        this.key = key;
    }
}