package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class NumberOfBuyBoxEligibleOfferElement {
    @SerializedName("Condition")
    private String condition;
    @SerializedName("FulfillmentChannel")
    private String fulfillmentChannel;
    @SerializedName("OfferCount")
    private long offerCount;

    /**
     * An explanation about the purpose of this instance.
     */
    public String getCondition() {
        return condition;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public String getFulfillmentChannel() {
        return fulfillmentChannel;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public long getOfferCount() {
        return offerCount;
    }
}
