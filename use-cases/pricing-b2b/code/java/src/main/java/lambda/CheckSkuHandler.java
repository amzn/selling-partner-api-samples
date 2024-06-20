package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Lists;
import com.google.gson.Gson;
import lambda.utils.B2B.*;
import lambda.utils.B2B.AOCN.B2BOffer;
import lambda.utils.B2C.Offer;
import lambda.utils.B2C.PriceChangeRule;
import lambda.utils.common.Seller;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;
import software.amazon.awssdk.services.dynamodb.streams.DynamoDbStreamsClient;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

import static lambda.utils.common.Constants.*;

public class CheckSkuHandler implements RequestHandler<StateMachineInputB2B, PricingOffersB2B> {

    public PricingOffersB2B handleRequest(StateMachineInputB2B input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("CheckSku Lambda input: " + new Gson().toJson(input));

        List<PricingLambdaInputB2B> sellerOffers = Lists.newArrayList();

        //Retrieve the items from DynamoDB by ASIN, seller ID, condition, and marketplace ID
        //Update this section to match your product's logic
        List<Map<String, AttributeValue>> skus = retrieveSKUs(
                input.getAsin(),
                input.getSeller().getSellerId(),
                input.getBuyBox().get(0).getCondition(),
                input.getCredentials().getMarketplaceId());

        for (Map<String, AttributeValue> sku : skus) {
            try {
                PricingLambdaInputB2B pricingOffer = new PricingLambdaInputB2B();
                pricingOffer.setFulfilledByAmazon(sku.get(SELLER_ITEMS_TABLE_IS_FULFILLED_BY_AMAZON_KEY_NAME).bool());
                pricingOffer.setItemSku(sku.get(SELLER_ITEMS_TABLE_SKU_KEY_NAME).s());
                pricingOffer.setBuyBox(input.getBuyBox());
                pricingOffer.setSellerId(input.getSeller().getSellerId());
                pricingOffer.setAsin(input.getAsin());
                pricingOffer.setCredentials(input.getCredentials());

                List<PricingRuleB2B> priceRuleList = new ArrayList<>();
                List<AttributeValue> priceRulesList = sku.get(SELLER_ITEMS_TABLE_PRICE_RULE_KEY_NAME).l();
                for (AttributeValue priceRules : priceRulesList){
                    PricingRuleB2B priceRule = new PricingRuleB2B();
                    Map<String, AttributeValue> priceRuleMap = priceRules.m();
                    priceRule.setOfferType(priceRuleMap.get(SELLER_ITEMS_TABLE_OFFER_TYPE_KEY_NAME).s());
                    priceRule.setQuantityTier(Float.parseFloat(priceRuleMap.get(SELLER_ITEMS_TABLE_QUANTITY_TIER_KEY_NAME).n()));
                    priceRule.setMinThreshold(Float.parseFloat(priceRuleMap.get(SELLER_ITEMS_TABLE_MIN_THRESHOLD_KEY_NAME).n()));
                    priceRule.setPriceChangeRule(priceRuleMap.get(SELLER_ITEMS_TABLE_PRICE_CHANGE_RULE_KEY_NAME).s());
                    priceRule.setPriceChangeRuleAmount(Float.parseFloat(priceRuleMap.get(SELLER_ITEMS_TABLE_PRICE_CHANGE_RULE_AMOUNT_KEY_NAME).n()));
                    priceRuleList.add(priceRule);
                }
                pricingOffer.setPricingRules(priceRuleList);


                List<Offer> notificationOffers = input.getSeller().getOffers().stream()
                        .filter(o -> o.isFulfilledByAmazon() == pricingOffer.isFulfilledByAmazon())
                        .collect(Collectors.toList());

                if (notificationOffers.size() == 1) {
                    pricingOffer.setSellerOffer(notificationOffers.get(0));
                } else if (notificationOffers.size() > 1) {
                    throw new InternalError(String.format("Error: %d offers were found in the notification for SKU %s",
                            notificationOffers.size(),
                            sku.get(SELLER_ITEMS_TABLE_SKU_KEY_NAME).s()));
                }
               // adding the SKUs that are only matching the fulfillment Channel
                if(input.getSeller().getOffers().get(0).isFulfilledByAmazon()==pricingOffer.isFulfilledByAmazon()){
                    sellerOffers.add(pricingOffer);
                }
            } catch (Exception e) {
                throw new InternalError("CheckSku Lambda failed", e);
            }
        }
        logger.log("CheckSku Lambda before return: " + new Gson().toJson(sellerOffers));

        return PricingOffersB2B.builder()
                .offers(sellerOffers)
                .build();
    }

    List<Map<String, AttributeValue>> retrieveSKUs(String asin, String sellerId, String condition, String marketplaceId) {
        QueryRequest queryRequest = QueryRequest.builder()
                .tableName(System.getenv(SELLER_ITEMS_TABLE_NAME_ENV_VARIABLE))
                .keyConditionExpression("#p_key = :asin")
                .filterExpression("#seller_key = :sid and #condition_key = :cond and #marketplace_id_key = :mid")
                .expressionAttributeNames(ImmutableMap.of(
                        "#p_key", SELLER_ITEMS_TABLE_HASH_KEY_NAME,
                        "#seller_key", SELLER_ITEMS_TABLE_SELLER_ID_KEY_NAME,
                        "#condition_key", SELLER_ITEMS_TABLE_CONDITION_KEY_NAME,
                        "#marketplace_id_key", SELLER_ITEMS_TABLE_MARKETPLACE_ID_KEY_NAME
                ))
                .expressionAttributeValues(ImmutableMap.of(
                        ":asin", AttributeValue.fromS(asin),
                        ":sid", AttributeValue.fromS(sellerId),
                        ":cond", AttributeValue.fromS(condition),
                        ":mid", AttributeValue.fromS(marketplaceId)
                ))
                .build();

        DynamoDbClient dynamoDB = DynamoDbClient.builder().build();
        QueryResponse queryResponse = dynamoDB.query(queryRequest);
        return queryResponse.items();
    }

}
