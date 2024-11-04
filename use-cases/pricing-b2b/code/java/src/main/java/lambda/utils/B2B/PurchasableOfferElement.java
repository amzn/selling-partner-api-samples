package lambda.utils.B2B;

import com.google.gson.annotations.SerializedName;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
public class PurchasableOfferElement {

    @SerializedName("audience")
    private OfferAudience offerAudience;

    @SerializedName("currency")
    private String currency;

    @SerializedName("marketplace_id")
    private String marketplaceId;

    @SerializedName("our_price")
    private List<PurchasableOfferPrice> ourPrices;

    @SerializedName("quantity_discount_plan")
    private List<QuantityDiscountPlan> quantityDiscountPlans;

    @Data
    @Builder
    public static class PurchasableOfferPrice {

        @SerializedName("schedule")
        private List<OfferSchedule> schedule;

        @Data
        @Builder
        public static class OfferSchedule {

            @SerializedName("value_with_tax")
            private float valueWithTax;
        }
    }

    @Builder
    public static class QuantityDiscountPlan {

        @SerializedName("schedule")
        private List<OfferSchedule> schedule;

        @Data
        @Builder
        public static class OfferSchedule {

            @SerializedName("discount_type")
            private DiscountType discountType;

            @SerializedName("levels")
            private List<QuantityDiscountLevel> quantityDiscountLevels;

            @Builder
            public static class QuantityDiscountLevel {

                @SerializedName("lower_bound")
                private int lowerBound;

                @SerializedName("value")
                private float value;
            }
        }
    }

    public enum OfferAudience {
        ALL, B2B
    }

    public enum DiscountType {
        @SerializedName("fixed")
        FIXED,

        @SerializedName("percent")
        PERCENT
    }
}

