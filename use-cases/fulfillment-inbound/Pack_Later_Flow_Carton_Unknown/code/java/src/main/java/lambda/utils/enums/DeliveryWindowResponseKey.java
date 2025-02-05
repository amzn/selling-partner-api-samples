package lambda.utils.enums;

import lombok.Getter;

@Getter
public enum DeliveryWindowResponseKey {
    DELIVERY_WINDOW_OPTION_ID("deliveryWindowOptionId"),
    ERROR("error");

    private final String key;

    DeliveryWindowResponseKey(String key) {
        this.key = key;
    }
}