package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import io.swagger.client.api.FbaOutboundApi;
import io.swagger.client.model.fbao.Address;
import io.swagger.client.model.fbao.CODSettings;
import io.swagger.client.model.fbao.CreateFulfillmentOrderRequest;
import io.swagger.client.model.fbao.CreateFulfillmentOrderResponse;
import io.swagger.client.model.fbao.CreateFulfillmentOrderItemList;
import io.swagger.client.model.fbao.CreateFulfillmentOrderItem;
import io.swagger.client.model.fbao.DeliveryWindow;
import io.swagger.client.model.fbao.FeatureSettings;
import io.swagger.client.model.fbao.FulfillmentAction;
import io.swagger.client.model.fbao.FulfillmentPolicy;
import io.swagger.client.model.fbao.Money;
import io.swagger.client.model.fbao.NotificationEmailList;
import io.swagger.client.model.fbao.ShippingSpeedCategory;
import lambda.utils.CreateFulfillmentOrderNotification;
import lambda.utils.DestinationAddress;
import lambda.utils.MCFCreateOrderLambdaInput;
import lambda.utils.OrderItem;
import java.util.List;
import java.util.ArrayList;

import static lambda.utils.ApiUtils.getFbaOutboundApi;

public class CreateOrderHandler implements RequestHandler<MCFCreateOrderLambdaInput, MCFCreateOrderLambdaInput> {

    public MCFCreateOrderLambdaInput handleRequest(MCFCreateOrderLambdaInput input, Context context) {
     LambdaLogger logger = context.getLogger();
        logger.log("CreateOrder input: " + input.getCreateFulfillmentOrderNotification());

        try {
            FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken());

            //Transform user input into a CreateFulfillmentOrderRequest
            CreateFulfillmentOrderRequest createFulfillmentOrderRequest = buildCreateFulfillmentOrderRequest(input.getCreateFulfillmentOrderNotification());
            logger.log("CreateFulfillmentOrderRequest value: " + createFulfillmentOrderRequest);

            CreateFulfillmentOrderResponse createFulfillmentOrderResponse = fbaoApi.createFulfillmentOrder(createFulfillmentOrderRequest);
            logger.log("CreateFulfillmentOrder call output: " + createFulfillmentOrderResponse);
        } catch (Exception e) {
            throw new InternalError("Calling FBAOutbound CreateOrder failed", e);
        }

        return input;
    }

    private CreateFulfillmentOrderRequest buildCreateFulfillmentOrderRequest(CreateFulfillmentOrderNotification createFulfillmentOrderNotification) {
        return new CreateFulfillmentOrderRequest()
            .marketplaceId(createFulfillmentOrderNotification.getMarketplaceId())
            .sellerFulfillmentOrderId(createFulfillmentOrderNotification.getSellerFulfillmentOrderId())
            .displayableOrderId(createFulfillmentOrderNotification.getDisplayableOrderId())
            .displayableOrderDate(createFulfillmentOrderNotification.getDisplayableOrderDate())
            .displayableOrderComment(createFulfillmentOrderNotification.getDisplayableOrderComment())
            .shippingSpeedCategory(buildShippingSpeedCategory(createFulfillmentOrderNotification.getShippingSpeedCategory()))
            .deliveryWindow(buildDeliveryWindow(createFulfillmentOrderNotification.getDeliveryWindow()))
            .destinationAddress(buildRequestAddress(createFulfillmentOrderNotification.getDestinationAddress()))
            .fulfillmentAction(buildFulfillmentAction(createFulfillmentOrderNotification.getFulfillmentAction()))
            .fulfillmentPolicy(buildFulfillmentPolicy(createFulfillmentOrderNotification.getFulfillmentPolicy()))
            .codSettings(buildCODSettings(createFulfillmentOrderNotification.getCodSettings()))
            .shipFromCountryCode(createFulfillmentOrderNotification.getShipFromCountryCode())
            .notificationEmails(buildNotificationEmails(createFulfillmentOrderNotification.getNotificationEmails()))
            .featureConstraints(buildFeatureConstraints(createFulfillmentOrderNotification.getFeatureConstraints()))
            .items(buildOrderItems(createFulfillmentOrderNotification.getItems()));
    }

    private NotificationEmailList buildNotificationEmails(List<String> notificationEmailList) {
        if (notificationEmailList != null) {
            NotificationEmailList notificationEmailListRequest = new NotificationEmailList();
            notificationEmailListRequest.addAll(notificationEmailList);
            return notificationEmailListRequest;
        } else {
            return null;
        }
    }

    private Address buildRequestAddress(DestinationAddress destinationAddress){
        return new Address()
            .name(destinationAddress.getName())
            .addressLine1(destinationAddress.getAddressLine1())
            .addressLine2(destinationAddress.getAddressLine2())
            .addressLine3(destinationAddress.getAddressLine3())
            .city(destinationAddress.getCity())
            .districtOrCounty(destinationAddress.getDistrictOrCounty())
            .stateOrRegion(destinationAddress.getStateOrRegion())
            .postalCode(destinationAddress.getPostalCode())
            .countryCode(destinationAddress.getCountryCode())
            .phone(destinationAddress.getPhone());
    } 


    private ShippingSpeedCategory buildShippingSpeedCategory(String shippingSpeed){
        switch(shippingSpeed) {
            case "Expedited":
                return ShippingSpeedCategory.EXPEDITED;
            case "Priority":
                return ShippingSpeedCategory.PRIORITY;
            case "ScheduledDelivery":
                return ShippingSpeedCategory.SCHEDULEDDELIVERY;
            default: // "Standard"
                return ShippingSpeedCategory.STANDARD;
        }
    }

    private DeliveryWindow buildDeliveryWindow(lambda.utils.DeliveryWindow deliveryWindow){
        if (deliveryWindow != null) {
            return new DeliveryWindow()
                .startDate(deliveryWindow.getStartDate())
                .endDate(deliveryWindow.getEndDate());        
        } else {
            return null;
        }
    }

    private FulfillmentAction buildFulfillmentAction(String fulfillmentAction) {
        if (fulfillmentAction!= null) {
            if(fulfillmentAction.equals("Hold")){
                return FulfillmentAction.HOLD;
            } else {
                return FulfillmentAction.SHIP;
            }
        } else {
            return null;
        }
    }

    private FulfillmentPolicy buildFulfillmentPolicy(String fulfillmentPolicy) {
        if (fulfillmentPolicy != null) {
            switch(fulfillmentPolicy) {
                case "FillAll":
                    return FulfillmentPolicy.FILLALL;
                case "FillAllAvailable":
                    return FulfillmentPolicy.FILLALLAVAILABLE;
                default: // "FillOrKill"
                    return FulfillmentPolicy.FILLORKILL;
            }
        } else {
            return null;
        }
    }

    private List<FeatureSettings> buildFeatureConstraints(List<lambda.utils.FeatureSettings> featureConstraints) {
        if (featureConstraints != null) {
            ArrayList<FeatureSettings> featureSettingsListRequest = new ArrayList<>();
            for (lambda.utils.FeatureSettings featureSetting: featureConstraints) {
                FeatureSettings featureSettingRequest = new FeatureSettings();
                if (featureSetting.getFeatureFulfillmentPolicy() != null) {
                    if (featureSetting.getFeatureFulfillmentPolicy().equals("Required")) {
                        featureSettingRequest.featureFulfillmentPolicy(FeatureSettings.FeatureFulfillmentPolicyEnum.REQUIRED);
                    } else {
                        featureSettingRequest.featureFulfillmentPolicy(FeatureSettings.FeatureFulfillmentPolicyEnum.NOTREQUIRED);
                    }
                }
                if (featureSetting.getFeatureName() != null) {
                    featureSettingRequest.featureName(featureSetting.getFeatureName());
                }
                featureSettingsListRequest.add(featureSettingRequest);
            }

            return featureSettingsListRequest;
        } else {
            return null;
        }
    }

    private CODSettings buildCODSettings(lambda.utils.CODSettings codSettings) {
        if (codSettings != null) {
            CODSettings codSettingsRequest = new CODSettings();

            codSettingsRequest.isCodRequired(codSettings.isCodRequired());
            if (codSettings.getCodCharge() != null) {
                codSettingsRequest.codCharge(new Money()
                    .currencyCode(codSettings.getCodCharge().getCurrencyCode())
                    .value(codSettings.getCodCharge().getValue()));
            }
            if (codSettings.getCodChargeTax() != null) {
                codSettingsRequest.codChargeTax(new Money()
                    .currencyCode(codSettings.getCodChargeTax().getCurrencyCode())
                    .value(codSettings.getCodChargeTax().getValue()));
            }
            if (codSettings.getShippingCharge() != null) {
                codSettingsRequest.shippingCharge(new Money()
                    .currencyCode(codSettings.getShippingCharge().getCurrencyCode())
                    .value(codSettings.getShippingCharge().getValue()));
            }
            if (codSettings.getShippingChargeTax() != null) {
                codSettingsRequest.shippingChargeTax(new Money()
                    .currencyCode(codSettings.getShippingChargeTax().getCurrencyCode())
                    .value(codSettings.getShippingChargeTax().getValue()));
            }
            return codSettingsRequest;
        } else {
            return null;
        }
    }


    private CreateFulfillmentOrderItemList buildOrderItems(List<OrderItem> orderItems) {
        CreateFulfillmentOrderItemList createFulfillmentOrderItemList = new CreateFulfillmentOrderItemList();
        for(OrderItem item: orderItems) {
            CreateFulfillmentOrderItem createFulfillmentOrderItem = new CreateFulfillmentOrderItem()
                    .sellerSku(item.getSellerSku())
                    .sellerFulfillmentOrderItemId(item.getSellerFulfillmentOrderItemId())
                    .quantity(item.getQuantity())
                    .giftMessage(item.getGiftMessage())
                    .displayableComment(item.getDisplayableComment())
                    .fulfillmentNetworkSku(item.getFulfillmentNetworkSku());
                    
            if (item.getPerUnitDeclaredValue() != null) {
                createFulfillmentOrderItem.perUnitDeclaredValue(
                    new Money()
                        .currencyCode(item.getPerUnitDeclaredValue().getCurrencyCode())
                        .value(item.getPerUnitDeclaredValue().getValue()));
            }

            if (item.getPerUnitPrice() != null) {
                createFulfillmentOrderItem.perUnitPrice(
                    new Money()
                        .currencyCode(item.getPerUnitPrice().getCurrencyCode())
                        .value(item.getPerUnitPrice().getValue()));
            }

            if (item.getPerUnitTax() != null) {
                createFulfillmentOrderItem.perUnitTax(
                    new Money()
                        .currencyCode(item.getPerUnitTax().getCurrencyCode())
                        .value(item.getPerUnitTax().getValue()));
            }

            createFulfillmentOrderItemList.add(createFulfillmentOrderItem);     
        }

        return createFulfillmentOrderItemList;
    }
}