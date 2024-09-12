
package lambda.utils.PricingHealth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lambda.utils.*;
import lombok.Data;

import javax.annotation.Generated;
import java.util.List;

import static lambda.utils.Constants.REFRESH_TOKEN_ARN_ENV_VARIABLE;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@Generated("jsonschema2pojo")
public class PricingHealthNotificationPayload implements PricingNotification {

    /**
     * The seller identifier for the offer
     * (Required)
     */
    @JsonProperty("sellerId")
    @JsonPropertyDescription("The seller identifier for the offer")
    public String sellerId;
    /**
     * The issue type for the notification
     * (Required)
     */
    @JsonProperty("issueType")
    @JsonPropertyDescription("The issue type for the notification")
    public String issueType;
    /**
     * The event that caused the notification to be sent
     * (Required)
     */
    @JsonProperty("offerChangeTrigger")
    @JsonPropertyDescription("The event that caused the notification to be sent")
    public OfferChangeTrigger offerChangeTrigger;
    /**
     * Offer details of the merchant receiving the notification
     * (Required)
     */
    @JsonProperty("merchantOffer")
    @JsonPropertyDescription("Offer details of the merchant receiving the notification")
    public MerchantOffer merchantOffer;
    /**
     * (Required)
     */
    @JsonProperty("summary")
    public Summary summary;

    @Override
    public String getAsin() {
        return offerChangeTrigger.getAsin();
    }

    @Override
    public String mapToPricingStateMachineInput() throws JsonProcessingException {
        ObjectMapper mapper = new ObjectMapper();
        StateMachineInput input = StateMachineInput.builder()
                .asin(offerChangeTrigger.getAsin())
                .credentials(ApiCredentials.builder()
                        .marketplaceId(offerChangeTrigger.getMarketplaceId())
                        .refreshToken(System.getenv(REFRESH_TOKEN_ARN_ENV_VARIABLE))
                        .build())
                .buyBox(getBuyBoxOffer(summary.getBuyBoxPrices().get(0)))
                .seller(getSellerWithOffers())
                .build();
        return mapper.writeValueAsString(input);
    }

    private BuyBoxOffer getBuyBoxOffer(BuyBoxPrice buyBoxPrice) {
        return BuyBoxOffer.builder()
                .condition(buyBoxPrice.getCondition())
                .price(Amount.builder()
                        .currencyCode(buyBoxPrice.getLandedPrice().getCurrencyCode())
                        .amount(buyBoxPrice.getLandedPrice().getAmount().floatValue())
                        .build())
                .build();
    }

    private Seller getSellerWithOffers() {
        List<Offer> sellerOffers = List.of(Offer.builder()
                .listingPrice(Amount.builder()
                        .currencyCode(merchantOffer.getListingPrice().getCurrencyCode())
                        .amount(merchantOffer.getListingPrice().getAmount().floatValue())
                        .build())
                .shippingPrice(Amount.builder()
                        .currencyCode(merchantOffer.getShipping().getCurrencyCode())
                        .amount(merchantOffer.getShipping().getAmount().floatValue())
                        .build())
                .isBuyBoxWinner(false)
                .isFulfilledByAmazon(!merchantOffer.getFulfillmentType().equals(MerchantOffer.FulfillmentType.MFN))
                .referencePrice(summary.getReferencePrice())
                .build());

        return Seller.builder()
                .sellerId(sellerId)
                .offers(sellerOffers)
                .build();
    }
}
