package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class ShippingTime {
    @SerializedName("AvailabilityType")
    private String availabilityType;
    
    @SerializedName("AvailableDate")
    private String availableDate;
    
    @SerializedName("MaximumHours")
    private long maximumHours;
    
    @SerializedName("MinimumHours")
    private long minimumHours;

    public String getAvailabilityType() {
        return availabilityType;
    }

    public String getAvailableDate() {
        return availableDate;
    }

    public long getMaximumHours() {
        return maximumHours;
    }

    public long getMinimumHours() {
        return minimumHours;
    }
}
