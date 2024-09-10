package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;

import lambda.utils.CreateFulfillmentOrderNotification;
import lambda.utils.MCFCreateOrderLambdaInput;
import lambda.utils.OrderItem;
import lambda.utils.DestinationAddress;

import io.swagger.client.api.FbaOutboundApi;
import io.swagger.client.model.fbao.Address;
import io.swagger.client.model.fbao.FeatureSettings;
import io.swagger.client.model.fbao.GetFulfillmentPreviewRequest;
import io.swagger.client.model.fbao.GetFulfillmentPreviewResponse;
import io.swagger.client.model.fbao.GetFulfillmentPreviewItemList;
import io.swagger.client.model.fbao.GetFulfillmentPreviewItem;

import java.util.List;
import java.util.ArrayList;

import static lambda.utils.ApiUtils.getFbaOutboundApi;

public class PreviewOrderHandler implements RequestHandler<MCFCreateOrderLambdaInput, MCFCreateOrderLambdaInput> {

    public MCFCreateOrderLambdaInput handleRequest(MCFCreateOrderLambdaInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("PreviewOrder input: " + input.getCreateFulfillmentOrderNotification());
    
        try {
            FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken());
            GetFulfillmentPreviewRequest getFulfillmentPreviewRequest = buildGetFulfillmentPreviewRequest(input.getCreateFulfillmentOrderNotification());
            
            GetFulfillmentPreviewResponse getFulfillmentPreviewResponse = fbaoApi.getFulfillmentPreview(getFulfillmentPreviewRequest);
            logger.log("GetFulfillmentPreview call output: " + getFulfillmentPreviewResponse);
        } catch (Exception e) {
            throw new InternalError("Calling GetFulfillmentPreview failed", e);
        }

        return input;
    }

    //Extract input from the create fulfillment order notification to create a fulfillment preview request
    //Note that under many use cases a preview request is built first, seprate from a desired create order request
    //i.e. a preview request is made first in order to identify what options and costs are available for a valid create order request
    private GetFulfillmentPreviewRequest buildGetFulfillmentPreviewRequest(CreateFulfillmentOrderNotification createFulfillmentOrderNotification) {
        Boolean includeCOD = createFulfillmentOrderNotification.getCodSettings() != null;
        Boolean includeDeliveryWindows = createFulfillmentOrderNotification.getDeliveryWindow() != null;

        return new GetFulfillmentPreviewRequest()
            .marketplaceId(createFulfillmentOrderNotification.getMarketplaceId())
            .address(buildRequestAddress(createFulfillmentOrderNotification.getDestinationAddress()))
            .items(buildPreviewItems(createFulfillmentOrderNotification.getItems()))
            .includeCODFulfillmentPreview(includeCOD)
            .includeDeliveryWindows(includeDeliveryWindows)
            .featureConstraints(buildFeatureConstraints(createFulfillmentOrderNotification.getFeatureConstraints()));
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

    private GetFulfillmentPreviewItemList buildPreviewItems(List<OrderItem> orderItemsInput) {
        GetFulfillmentPreviewItemList getFulfillmentPreviewItemList = new GetFulfillmentPreviewItemList();

        for(OrderItem item: orderItemsInput) {
            getFulfillmentPreviewItemList.add(
                new GetFulfillmentPreviewItem()
                    .sellerSku(item.getSellerSku())
                    .quantity(item.getQuantity())
                    .sellerFulfillmentOrderItemId(item.getSellerFulfillmentOrderItemId())
            );
        }

        return getFulfillmentPreviewItemList;
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
}
