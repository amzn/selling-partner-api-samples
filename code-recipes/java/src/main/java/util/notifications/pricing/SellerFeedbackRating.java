package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;

/**
 * An explanation about the purpose of this instance.
 */
public class SellerFeedbackRating {
    @SerializedName("FeedbackCount")
    private long feedbackCount;
    @SerializedName("SellerPositiveFeedbackRating")
    private long sellerPositiveFeedbackRating;

    /**
     * An explanation about the purpose of this instance.
     */
    public long getFeedbackCount() {
        return feedbackCount;
    }

    /**
     * An explanation about the purpose of this instance.
     */
    public long getSellerPositiveFeedbackRating() {
        return sellerPositiveFeedbackRating;
    }
}
