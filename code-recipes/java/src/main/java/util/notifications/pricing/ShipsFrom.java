package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class ShipsFrom {
    @SerializedName("Country")
    private String country;
    @SerializedName("State")
    private String state;

    /**
     * An explanation about the purpose of this instance.
     */
    public String getCountry() {
        return country;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public String getState() {
        return state;
    }
}
