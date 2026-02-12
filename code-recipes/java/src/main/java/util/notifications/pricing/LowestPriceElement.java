package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class LowestPriceElement {
    @SerializedName("Condition")
    private String condition;
    @SerializedName("FulfillmentChannel")
    private String fulfillmentChannel;
    @SerializedName("LandedPrice")
    private LowestPriceLandedPrice landedPrice;
    @SerializedName("ListingPrice")
    private LowestPriceListingPrice listingPrice;
    @SerializedName("Shipping")
    private LowestPriceShipping shipping;
    @SerializedName("Points")
    private LowestPricePoints points;

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
    public LowestPriceLandedPrice getLandedPrice() {
        return landedPrice;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public LowestPriceListingPrice getListingPrice() {
        return listingPrice;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public LowestPriceShipping getShipping() {
        return shipping;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public LowestPricePoints getPoints() {
        return points;
    }
}
