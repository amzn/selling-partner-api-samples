package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class Payload {
    @SerializedName("AnyOfferChangedNotification")
    private AnyOfferChangedNotification anyOfferChangedNotification;

    /**
     * An explanation about the purpose of this instance.
     */
    public AnyOfferChangedNotification getAnyOfferChangedNotification() {
        return anyOfferChangedNotification;
    }
}
