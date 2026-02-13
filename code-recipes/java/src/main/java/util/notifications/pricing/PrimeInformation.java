package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class PrimeInformation {
    @SerializedName("IsOfferNationalPrime")
    private boolean isOfferNationalPrime;
    @SerializedName("IsOfferPrime")
    private boolean isOfferPrime;

    /**
     * An explanation about the purpose of this instance.
     */
    public boolean getIsOfferNationalPrime() {
        return isOfferNationalPrime;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public boolean getIsOfferPrime() {
        return isOfferPrime;
    }
}
