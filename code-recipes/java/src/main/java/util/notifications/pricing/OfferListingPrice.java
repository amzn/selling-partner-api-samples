package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class OfferListingPrice {
    @SerializedName("Amount")
    private double amount;
    @SerializedName("CurrencyCode")
    private String currencyCode;

    /**
     * An explanation about the purpose of this instance.
     */
    public double getAmount() {
        return amount;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public String getCurrencyCode() {
        return currencyCode;
    }
}
