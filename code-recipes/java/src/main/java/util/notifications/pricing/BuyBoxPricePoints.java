package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class BuyBoxPricePoints {
    @SerializedName("PointsNumber")
    private long pointsNumber;

    /**
     * An explanation about the purpose of this instance.
     */
    public long getPointsNumber() {
        return pointsNumber;
    }
}
