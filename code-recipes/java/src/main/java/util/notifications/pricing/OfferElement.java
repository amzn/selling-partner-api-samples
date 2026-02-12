package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class OfferElement {
    @SerializedName("IsExpeditedShippingAvailable")
    private boolean isExpeditedShippingAvailable;
    
    @SerializedName("IsFeaturedMerchant")
    private boolean isFeaturedMerchant;
    
    @SerializedName("IsFulfilledByAmazon")
    private boolean isFulfilledByAmazon;
    
    @SerializedName("ListingPrice")
    private OfferListingPrice listingPrice;
    
    @SerializedName("Points")
    private OfferPoints points;
    
    @SerializedName("PrimeInformation")
    private PrimeInformation primeInformation;
    
    @SerializedName("SellerFeedbackRating")
    private SellerFeedbackRating sellerFeedbackRating;
    
    @SerializedName("SellerId")
    private String sellerid;
    
    @SerializedName("Shipping")
    private OfferShipping shipping;
    
    @SerializedName("ShippingTime")
    private ShippingTime shippingTime;
    
    @SerializedName("ShipsDomestically")
    private boolean shipsDomestically;
    
    @SerializedName("ShipsFrom")
    private ShipsFrom shipsFrom;
    
    @SerializedName("ShipsInternationally")
    private boolean shipsInternationally;
    
    @SerializedName("SubCondition")
    private String subCondition;

    public boolean getIsExpeditedShippingAvailable() {
        return isExpeditedShippingAvailable;
    }

    public boolean getIsFeaturedMerchant() {
        return isFeaturedMerchant;
    }

    public boolean getIsFulfilledByAmazon() {
        return isFulfilledByAmazon;
    }

    public OfferListingPrice getListingPrice() {
        return listingPrice;
    }

    public OfferPoints getPoints() {
        return points;
    }

    public PrimeInformation getPrimeInformation() {
        return primeInformation;
    }

    public SellerFeedbackRating getSellerFeedbackRating() {
        return sellerFeedbackRating;
    }

    public String getSellerid() {
        return sellerid;
    }

    public OfferShipping getShipping() {
        return shipping;
    }

    public ShippingTime getShippingTime() {
        return shippingTime;
    }

    public boolean getShipsDomestically() {
        return shipsDomestically;
    }

    public ShipsFrom getShipsFrom() {
        return shipsFrom;
    }

    public boolean getShipsInternationally() {
        return shipsInternationally;
    }

    public String getSubCondition() {
        return subCondition;
    }
}
