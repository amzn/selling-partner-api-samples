package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Lists;
import com.google.gson.Gson;
import lambda.utils.Offer;
import lambda.utils.PriceChangeRule;
import lambda.utils.PricingLambdaInput;
import lambda.utils.PricingOffers;
import lambda.utils.StateMachineInput;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static lambda.utils.Constants.SELLER_ITEMS_TABLE_CONDITION_KEY_NAME;
import static lambda.utils.Constants.SELLER_ITEMS_TABLE_IS_FULFILLED_BY_AMAZON_KEY_NAME;
import static lambda.utils.Constants.SELLER_ITEMS_TABLE_MARKETPLACE_ID_KEY_NAME;
import static lambda.utils.Constants.SELLER_ITEMS_TABLE_MIN_THRESHOLD_KEY_NAME;
import static lambda.utils.Constants.SELLER_ITEMS_TABLE_NAME_ENV_VARIABLE;
import static lambda.utils.Constants.SELLER_ITEMS_TABLE_HASH_KEY_NAME;
import static lambda.utils.Constants.SELLER_ITEMS_TABLE_PRICE_CHANGE_RULE_AMOUNT_KEY_NAME;
import static lambda.utils.Constants.SELLER_ITEMS_TABLE_PRICE_CHANGE_RULE_KEY_NAME;
import static lambda.utils.Constants.SELLER_ITEMS_TABLE_SELLER_ID_KEY_NAME;
import static lambda.utils.Constants.SELLER_ITEMS_TABLE_SKU_KEY_NAME;

public class CheckSkuHandler implements RequestHandler<StateMachineInput, PricingOffers> {

    public PricingOffers handleRequest(StateMachineInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("CheckSku Lambda input: " + new Gson().toJson(input));

        List<PricingLambdaInput> sellerOffers = Lists.newArrayList();

        //Retrieve the items from DynamoDB by ASIN, seller ID, condition, and marketplace ID
        //Update this section to match your product's logic
        List<Map<String, AttributeValue>> skus = retrieveSKUs(
                input.getAsin(),
                input.getSeller().getSellerId(),
                input.getBuyBox().getCondition(),
                input.getCredentials().getMarketplaceId());

        for (Map<String, AttributeValue> sku : skus) {
            try {
                PricingLambdaInput pricingOffer = PricingLambdaInput.builder()
                        .isFulfilledByAmazon(sku.get(SELLER_ITEMS_TABLE_IS_FULFILLED_BY_AMAZON_KEY_NAME).bool())
                        .itemSku(sku.get(SELLER_ITEMS_TABLE_SKU_KEY_NAME).s())
                        .minThreshold(Float.valueOf(sku.get(SELLER_ITEMS_TABLE_MIN_THRESHOLD_KEY_NAME).n()))
                        .priceChangeRule(PriceChangeRule.builder()
                                .value(Float.valueOf(sku.get(SELLER_ITEMS_TABLE_PRICE_CHANGE_RULE_AMOUNT_KEY_NAME).n()))
                                .rule(sku.get(SELLER_ITEMS_TABLE_PRICE_CHANGE_RULE_KEY_NAME).s())
                                .build())

                        .useCompetitivePrice(Boolean.valueOf(true))
                        .buyBox(input.getBuyBox())
                        .sellerId(input.getSeller().getSellerId())
                        .asin(input.getAsin())
                        .credentials(input.getCredentials())
                        .build();

                List<Offer> notificationOffers = input.getSeller().getOffers().stream()
                        .filter(o -> o.isFulfilledByAmazon() == pricingOffer.isFulfilledByAmazon())
                        .collect(Collectors.toList());

                if (notificationOffers.size() == 1) {
                    pricingOffer.setSellerOffer(notificationOffers.get(0));
                } else if (notificationOffers.size() > 1) {
                    throw new InternalError(String.format("Error: %d offers where found in the notification for SKU %s",
                            notificationOffers.size(),
                            sku.get(SELLER_ITEMS_TABLE_SKU_KEY_NAME).s()));
                }

                sellerOffers.add(pricingOffer);
            } catch (Exception e) {
                throw new InternalError("CheckSku Lambda failed", e);
            }
        }

        return PricingOffers.builder()
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
