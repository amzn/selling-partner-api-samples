package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class OfferChangeTrigger {
    @SerializedName("ASIN")
    private String asin;
    
    @SerializedName("ItemCondition")
    private String itemCondition;
    
    @SerializedName("MarketplaceId")
    private String marketplaceid;
    
    @SerializedName("OfferChangeType")
    private String offerChangeType;
    
    @SerializedName("TimeOfOfferChange")
    private String timeOfOfferChange;

    public String getAsin() {
        return asin;
    }

    public String getItemCondition() {
        return itemCondition;
    }

    public String getMarketplaceid() {
        return marketplaceid;
    }

    public String getOfferChangeType() {
        return offerChangeType;
    }

    public String getTimeOfOfferChange() {
        return timeOfOfferChange;
    }
}
