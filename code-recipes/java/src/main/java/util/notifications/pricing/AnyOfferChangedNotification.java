package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;
import java.util.List;

/**
 * An explanation about the purpose of this instance.
 */
public class AnyOfferChangedNotification {
    @SerializedName("OfferChangeTrigger")
    private OfferChangeTrigger offerChangeTrigger;
    
    @SerializedName("Offers")
    private List<OfferElement> offers;
    
    @SerializedName("SellerId")
    private String sellerid;
    
    @SerializedName("Summary")
    private Summary summary;

    public OfferChangeTrigger getOfferChangeTrigger() {
        return offerChangeTrigger;
    }

    public List<OfferElement> getOffers() {
        return offers;
    }

    public String getSellerid() {
        return sellerid;
    }

    public Summary getSummary() {
        return summary;
    }
}
