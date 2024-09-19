package lambda.utils.enums;

import lombok.Getter;

@Getter
public enum PackingResponseKey {
    PACKING_OPTION_ID("packingOptionId"),
    PACKING_GROUP_ID("packingGroupId"),
    ERROR("error");

    private final String key;

    PackingResponseKey(String key) {
        this.key = key;
    }
}
