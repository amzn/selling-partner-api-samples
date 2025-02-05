package lambda.utils.enums;

import lombok.Getter;

@Getter
public enum InboundPlanBoxesResponseKey {
    BOX_ID("boxId"),
    ERROR("error");

    private final String key;

    InboundPlanBoxesResponseKey (String key) {
        this.key = key;
    }
}
