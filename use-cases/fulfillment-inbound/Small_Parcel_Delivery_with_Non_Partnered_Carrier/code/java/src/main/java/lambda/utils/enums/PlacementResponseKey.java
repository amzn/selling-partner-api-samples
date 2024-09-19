package lambda.utils.enums;

import lombok.Getter;

@Getter
public enum PlacementResponseKey {
    PLACEMENT_OPTION_ID("placementOptionId"),
    SHIPMENT_ID("shipmentId"),
    ERROR("error");

    private final String key;

    PlacementResponseKey(String key) {
        this.key = key;
    }
}