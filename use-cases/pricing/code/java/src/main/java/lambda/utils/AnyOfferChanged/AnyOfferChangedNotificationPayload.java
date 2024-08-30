package lambda.utils.AnyOfferChanged;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lambda.utils.*;
import lombok.Data;

import java.util.List;
import java.util.stream.Collectors;

import static lambda.utils.Constants.REFRESH_TOKEN_ARN_ENV_VARIABLE;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AnyOfferChangedNotificationPayload implements PricingNotification {

    @JsonProperty("SellerId")
    public String sellerId;

    @JsonProperty("OfferChangeTrigger")
    public OfferChangeTrigger offerChangeTrigger;

    @JsonProperty("Summary")
    public AnyOfferChangedSummary summary;

    @JsonProperty("Offers")
    public List<NotificationOffer> offers;

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

    private BuyBoxOffer getBuyBoxOffer(NotificationPrice buyBoxPrice) {
        return BuyBoxOffer.builder()
                .condition(buyBoxPrice.getCondition())
                .price(Amount.builder()
                        .currencyCode(buyBoxPrice.getLandedPrice().getCurrencyCode())
                        .amount(buyBoxPrice.getLandedPrice().getAmount())
                        .build())
                .build();
    }

    private Seller getSellerWithOffers() {
        List<Offer> sellerOffers = offers.stream()
                .filter(o -> o.getSellerId().equals(sellerId))
                .map(o -> Offer.builder()
                        .listingPrice(Amount.builder()
                                .currencyCode(o.getListingPrice().getCurrencyCode())
                                .amount(o.getListingPrice().getAmount())
                                .build())
                        .shippingPrice(Amount.builder()
                                .currencyCode(o.getShippingPrice().getCurrencyCode())
                                .amount(o.getShippingPrice().getAmount())
                                .build())
                        .isBuyBoxWinner(o.isBuyBoxWinner())
                        .isFulfilledByAmazon(o.isFulfilledByAmazon())
                        .build())
                .collect(Collectors.toList());

        return Seller.builder()
                .sellerId(sellerId)
                .offers(sellerOffers)
                .build();
    }
}
