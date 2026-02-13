package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class BuyBoxPriceElement {
    @SerializedName("Condition")
    private String condition;
    @SerializedName("LandedPrice")
    private BuyBoxPriceLandedPrice landedPrice;
    @SerializedName("ListingPrice")
    private BuyBoxPriceListingPrice listingPrice;
    @SerializedName("Shipping")
    private BuyBoxPriceShipping shipping;
    @SerializedName("Points")
    private BuyBoxPricePoints points;

    /**
     * An explanation about the purpose of this instance.
     */
    public String getCondition() {
        return condition;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public BuyBoxPriceLandedPrice getLandedPrice() {
        return landedPrice;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public BuyBoxPriceListingPrice getListingPrice() {
        return listingPrice;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public BuyBoxPriceShipping getShipping() {
        return shipping;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public BuyBoxPricePoints getPoints() {
        return points;
    }
}
