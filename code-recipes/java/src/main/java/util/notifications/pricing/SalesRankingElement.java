package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class SalesRankingElement {
    @SerializedName("ProductCategoryId")
    private String productCategoryid;
    @SerializedName("Rank")
    private long rank;

    /**
     * An explanation about the purpose of this instance.
     */
    public String getProductCategoryid() {
        return productCategoryid;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public long getRank() {
        return rank;
    }
}
