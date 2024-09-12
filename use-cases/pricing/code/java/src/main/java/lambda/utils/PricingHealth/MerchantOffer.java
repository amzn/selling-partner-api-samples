
package lambda.utils.PricingHealth;

import com.fasterxml.jackson.annotation.*;
import lombok.Data;

import javax.annotation.Generated;
import java.util.HashMap;
import java.util.Map;


/**
 * Offer details of the merchant receiving the notification
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@Generated("jsonschema2pojo")
public class MerchantOffer {

    /**
     * Indicates the condition of the item
     * (Required)
     */
    @JsonProperty("condition")
    @JsonPropertyDescription("Indicates the condition of the item")
    public String condition;
    /**
     * Indicates whether the item is fulfilled by Amazon or by the seller
     * (Required)
     */
    @JsonProperty("fulfillmentType")
    @JsonPropertyDescription("Indicates whether the item is fulfilled by Amazon or by the seller")
    public MerchantOffer.FulfillmentType fulfillmentType;
    /**
     * (Required)
     */
    @JsonProperty("landedPrice")
    public MoneyType landedPrice;
    /**
     * (Required)
     */
    @JsonProperty("listingPrice")
    public MoneyType listingPrice;
    /**
     * (Required)
     */
    @JsonProperty("shipping")
    public MoneyType shipping;
    /**
     * The number of Amazon Points offered with the purchase of an item
     */
    @JsonProperty("points")
    @JsonPropertyDescription("The number of Amazon Points offered with the purchase of an item")
    public Points points;


    /**
     * Indicates whether the item is fulfilled by Amazon or by the seller
     */
    @Generated("jsonschema2pojo")
    public enum FulfillmentType {

        AFN("AFN"),
        MFN("MFN");
        private final String value;
        private final static Map<String, MerchantOffer.FulfillmentType> CONSTANTS = new HashMap<String, MerchantOffer.FulfillmentType>();

        static {
            for (MerchantOffer.FulfillmentType c : values()) {
                CONSTANTS.put(c.value, c);
            }
        }

        FulfillmentType(String value) {
            this.value = value;
        }

        @Override
        public String toString() {
            return this.value;
        }

        @JsonValue
        public String value() {
            return this.value;
        }

        @JsonCreator
        public static MerchantOffer.FulfillmentType fromValue(String value) {
            MerchantOffer.FulfillmentType constant = CONSTANTS.get(value);
            if (constant == null) {
                throw new IllegalArgumentException(value);
            } else {
                return constant;
            }
        }

    }

}
