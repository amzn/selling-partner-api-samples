package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.api.MerchantFulfillmentApi;
import io.swagger.client.model.mfn.CreateShipmentRequest;
import io.swagger.client.model.mfn.CreateShipmentResponse;
import io.swagger.client.model.mfn.Label;
import io.swagger.client.model.mfn.ShipmentRequestDetails;
import lambda.utils.MfnLambdaInput;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;

import java.util.HashMap;
import java.util.Map;

import static lambda.utils.ApiUtils.getMFNApi;
import static lambda.utils.Constants.SHIPMENTS_TABLE_HASH_KEY_NAME;
import static lambda.utils.Constants.SHIPMENTS_TABLE_NAME_ENV_VARIABLE;
import static lambda.utils.Constants.SHIPMENTS_TABLE_SHIPMENT_ID_ATTRIBUTE_NAME;
import static lambda.utils.MfnUtils.getDefaultShippingServiceOptions;
import static lambda.utils.MfnUtils.getItemList;

public class CreateShipmentHandler implements RequestHandler<MfnLambdaInput, Label> {

    public Label handleRequest(MfnLambdaInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("CreateShipment Lambda input: " + new Gson().toJson(input));

        try {
            //Create shipment for the selected shipping service
            CreateShipmentRequest request = new CreateShipmentRequest()
                    .shipmentRequestDetails(new ShipmentRequestDetails()
                            .amazonOrderId(input.getOrderId())
                            .itemList(getItemList(input.getMfnOrder().getOrderItems()))
                            .shipFromAddress(input.getMfnOrder().getShipFromAddress())
                            .packageDimensions(input.getMfnOrder().getPackageDimensions())
                            .weight(input.getMfnOrder().getWeight())
                            .shippingServiceOptions(getDefaultShippingServiceOptions()))
                    .shippingServiceId(input.getMfnOrder().getPreferredShippingService().getShippingServiceId())
                    .shippingServiceOfferId(input.getMfnOrder().getPreferredShippingService().getShippingServiceOfferId());

            logger.log("Merchant Fulfillment API - CreateShipment request: " + new Gson().toJson(request));

            MerchantFulfillmentApi mfnApi = getMFNApi(input.getRegionCode(), input.getRefreshToken());
            CreateShipmentResponse response = mfnApi.createShipment(request);

            //Store ShipmentId in DynamoDB
            //Update this section to match your product's logic
            String shipmentId = response.getPayload().getShipmentId();
            storeShipmentInformation(input.getOrderId(), shipmentId);

            return response.getPayload().getLabel();
        } catch (Exception e) {
            throw new InternalError("Calling Merchant Fulfillment API failed", e);
        }
    }

    private void storeShipmentInformation(String orderId, String shipmentId) {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put(SHIPMENTS_TABLE_HASH_KEY_NAME, AttributeValue.fromS(orderId));
        item.put(SHIPMENTS_TABLE_SHIPMENT_ID_ATTRIBUTE_NAME, AttributeValue.fromS(shipmentId));

        PutItemRequest putItemRequest = PutItemRequest.builder()
                .tableName(System.getenv(SHIPMENTS_TABLE_NAME_ENV_VARIABLE))
                .item(item)
                .build();

        DynamoDbClient dynamoDB = DynamoDbClient.builder().build();
        dynamoDB.putItem(putItemRequest);
    }
}
