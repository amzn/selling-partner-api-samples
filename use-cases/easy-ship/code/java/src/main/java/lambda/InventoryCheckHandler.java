package lambda;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.client.model.easyship.UnitOfLength;
import io.swagger.client.model.easyship.UnitOfWeight;
import io.swagger.client.model.easyship.Weight;
import io.swagger.client.model.easyship.Dimensions;
import lambda.utils.*;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import static java.lang.Long.parseLong;
import static lambda.utils.Constants.*;

public class InventoryCheckHandler implements RequestHandler<StateMachineInput, StateMachineInput> {

    @Override
    public StateMachineInput handleRequest(StateMachineInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("InventoryCheck Lambda input: " + new Gson().toJson(input));

        long packageWeightValue = 0;
        String packageWeightUnit = "";
        long packageLength = 0;
        long packageWidth = 0;
        long packageHeight = 0;
        String packageSizeUnit = "";

        for (EasyShipOrderItem orderItem : input.getEasyShipOrder().getOrderItems()) {
            //Retrieve the item from DynamoDB by SKU
            //Update this section to match your product's logic
            Map<String, AttributeValue> key = new HashMap<>();
            key.put(INVENTORY_TABLE_HASH_KEY_NAME, AttributeValue.fromS(orderItem.getSku()));
            GetItemRequest getItemRequest = GetItemRequest.builder()
                    .tableName(System.getenv(INVENTORY_TABLE_NAME_ENV_VARIABLE))
                    .key(key)
                    .build();

            DynamoDbClient dynamoDB = DynamoDbClient.builder().build();
            GetItemResponse getItemResult = dynamoDB.getItem(getItemRequest);
            Map<String, AttributeValue> item = getItemResult.item();

            String stock = item.get(INVENTORY_TABLE_STOCK_ATTRIBUTE_NAME).n();

            if (parseLong(stock) < orderItem.getQuantity()) {
                throw new InternalError(
                        String.format("Stock level for SKU {%s} is not enough to fulfill the requested quantity",
                                orderItem.getSku()));
            }

            long itemWeightValue = parseLong(item.get(INVENTORY_TABLE_WEIGHT_VALUE_ATTRIBUTE_NAME).n());
            //Valid values for the database records are uppercase: [OZ, G]
            String itemWeightUnit = item.get(INVENTORY_TABLE_WEIGHT_UNIT_ATTRIBUTE_NAME).s();

            long itemLength = parseLong(item.get(INVENTORY_TABLE_LENGTH_ATTRIBUTE_NAME).n());
            long itemWidth = parseLong(item.get(INVENTORY_TABLE_WIDTH_ATTRIBUTE_NAME).n());
            long itemHeight = parseLong(item.get(INVENTORY_TABLE_HEIGHT_ATTRIBUTE_NAME).n());
            //Valid values for the database records are uppercase: [INCHES, CENTIMETERS]
            String itemSizeUnit = item.get(INVENTORY_TABLE_SIZE_UNIT_ATTRIBUTE_NAME).s();

            Weight itemWeight = new Weight();
            itemWeight.setValue(BigDecimal.valueOf(itemWeightValue));
            itemWeight.setUnit(UnitOfWeight.valueOf(itemWeightUnit));

            //Package weight is calculated by adding the individual weights
            //Update this section to match your selling partners' logic
            packageWeightValue += itemWeightValue;
            packageWeightUnit = itemWeightUnit;

            //Package size is calculated by adding the individual sizes
            //Update this section to match your selling partners' logic
            packageLength += itemLength;
            packageWidth += itemWidth;
            packageHeight += itemHeight;
            packageSizeUnit = itemSizeUnit;
        }

        input.getEasyShipOrder().setPackageWeight(new Weight()
                .value(BigDecimal.valueOf(packageWeightValue))
                .unit(UnitOfWeight.valueOf(packageWeightUnit)));

        input.getEasyShipOrder().setPackageDimensions(new Dimensions()
                .length(BigDecimal.valueOf(packageLength))
                .width(BigDecimal.valueOf(packageWidth))
                .height(BigDecimal.valueOf(packageHeight))
                .unit(UnitOfLength.valueOf(packageSizeUnit)));

        return input;
    }
}
