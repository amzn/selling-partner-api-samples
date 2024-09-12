## Fulfillment Outbound API
The Selling Partner API for Fulfillment Outbound (Fulfillment Outbound API) lets you create applications that help a seller fulfill Multi-Channel Fulfillment orders using their inventory in Amazon's fulfillment network. You can also get information on both potential and existing fulfillment orders.

If you haven't already, we recommend you to navigate the following resources:
* [Fulfillment Outbound API Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/fulfillment-outbound-api-v2020-07-01-use-case-guide)
* [Fulfillment Outbound API v2020-07-01 reference](https://developer-docs.amazon.com/sp-api/docs/fulfillment-outbound-api-v2020-07-01-reference)
* [Fulfillment Outbound Solution: Setup and Installation Tutorial](https://www.youtube.com/watch?v=ZUw5Ubb8Rj0)


## Solution
This Sample Solution implements the following fulfillment outbound operations:
* [Create fulfillment order](#create-fulfillment-order)
* [Get fulfillment order](#get-fulfillment-order)
* [Update fulfillment order](#update-fulfillment-order)
* [Cancel fulfillment order](#cancel-fulfillment-order)
* [Get package tracking details](#get-package-tracking-details)
* [Get fulfillment preview](#get-fulfillment-preview)

If you want to test the proposed solution, do changes and/or integrate it to your own product, follow the steps under [Deployment Guide](docs/DEPLOYMENT.md).

## Create fulfillment order
In order to create a fulfillment order, you have to setup the API client accordingly, build the request body and finally create the fulfillment order.

### Sample Code
Below you can find sample code for the create fulfillment order operation.

#### Step-by-step:
1. **Set up the API client:** Initialize the FBA Outbound API client by providing refresh token and region code.
2. **Build the request body:** Build the `CreateFulfillmentOrderRequest` object and set all required data.
3. **Execute the call:** Create a new order by calling `createFulfillmentOrder` operation.

#### Java
*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/fulfillment-outbound/code/java/src/main/java/lambda/CreateOrderHandler.java)*
```java
public MCFCreateOrderLambdaInput handleRequest(MCFCreateOrderLambdaInput input, Context context) {
    try {
        FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken());
        
        CreateFulfillmentOrderRequest createFulfillmentOrderRequest = buildCreateFulfillmentOrderRequest(input.getCreateFulfillmentOrderNotification());
        
        fbaoApi.createFulfillmentOrder(createFulfillmentOrderRequest);
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
```

## Get fulfillment order
In order to get a fulfillment order, you have to setup the API client accordingly and execute the get fulfillment order operation.

### Sample Code
Below you can find sample code for the get fulfillment order operation.

#### Step-by-step:
1. **Set up the API client:** Initialize the FBA Outbound API client by providing refresh token and region code.
2. **Execute the call:** Call `getFulfillmentOrder` operation to get a specific fulfillment order with given `sellerFulfillmentOrderId`.

#### Java
*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/fulfillment-outbound/code/java/src/main/java/lambda/GetOrderHandler.java)*
```java
public MCFCreateOrderLambdaInput handleRequest(MCFCreateOrderLambdaInput input, Context context) {

    try {
        FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken());

        GetFulfillmentOrderResponse getFulfillmentOrderResponse = fbaoApi.getFulfillmentOrder(input.getCreateFulfillmentOrderNotification().getSellerFulfillmentOrderId());
    } catch (Exception e) {
        throw new InternalError("Calling FBAOutbound GetOrder failed", e);
    }

    return input;
}
```

## Update fulfillment order
In order to update a fulfillment order, you have to setup the API client accordingly, build the request body and finally update the fulfillment order.

### Sample Code
Below you can find sample code for the update fulfillment order operation.

#### Step-by-step:
1. **Set up the API client:** Initialize the FBA Outbound API client by providing refresh token and region code.
2. **Build the request body:** Build the `UpdateFulfillmentOrderRequest` object and set all required data.
3. **Execute the call:** Update a fulfillment order by calling `updateFulfillmentOrder` operation.

#### Java
*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/fulfillment-outbound/code/java/src/main/java/lambda/UpdateOrderHandler.java)*
```java
public MCFCreateOrderLambdaInput handleRequest(MCFCreateOrderLambdaInput input, Context context) {

    try {
        FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken());
        
        UpdateFulfillmentOrderRequest updateFulfillmentOrderRequest = new UpdateFulfillmentOrderRequest()
                .fulfillmentAction(FulfillmentAction.SHIP);

        UpdateFulfillmentOrderResponse updateFulfillmentOrderResponse = fbaoApi.updateFulfillmentOrder(updateFulfillmentOrderRequest, input.getCreateFulfillmentOrderNotification().getSellerFulfillmentOrderId());
    } catch (Exception e) {
        throw new InternalError("Calling FBAOutbound UpdateOrder failed", e);
    }

    return input;
}
```

## Cancel fulfillment order
In order to cancel a fulfillment order, you have to setup the API client accordingly and execute the cancel fulfillment order operation.

### Sample Code
Below you can find sample code for the cancel fulfillment order operation.

#### Step-by-step:
1. **Set up the API client:** Initialize the FBA Outbound API client by providing refresh token and region code.
2. **Execute the call:** Call `cancelFulfillmentOrder` operation to cancel a specific fulfillment order with given `sellerFulfillmentOrderId`.

#### Java
*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/fulfillment-outbound/code/java/src/main/java/lambda/CancelOrderHandler.java)*
```java
public MCFCancelOrderLambdaInput handleRequest(MCFCancelOrderLambdaInput input, Context context) {

    try {
        FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken());

        CancelFulfillmentOrderResponse cancelFulfillmentOrderResponse = fbaoApi.cancelFulfillmentOrder(input.getCancelFulfillmentOrderNotification().getSellerFulfillmentOrderId());
    } catch (Exception e) {
        throw new InternalError("Calling FBAOutbound CancelOrder failed", e);
    }

    return input;
}
```

## Get package tracking details
In order to get package tracking details, you have to setup the API client accordingly and retrieve tracking details for each package number individually.

### Sample Code
Below you can find sample code for the get package tracking details operation.

#### Step-by-step:
1. **Set up the API client:** Initialize the FBA Outbound API client by providing refresh token and region code.
2. **Iterate through package numbers to retrieve tracking details:** For each package number call  `getPackageTrackingDetails` operation.

#### Java
*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/fulfillment-outbound/code/java/src/main/java/lambda/GetPackageTrackingDetailsHandler.java)*
```java
public MCFTrackingDetailsLambdaInput handleRequest(MCFTrackingDetailsLambdaInput input, Context context) {
    
    try {
        FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken());
        
        for (Integer packageNumber : input.getPackageNumbers()) {
            GetPackageTrackingDetailsResponse getPackageTrackingDetailsResponse = fbaoApi.getPackageTrackingDetails(packageNumber);
            
            // Examine and continue processing package tracking details
            // ...
        }

    } catch (Exception e) {
        throw new InternalError("Calling FBAOutbound GetPackageTrackingDetails failed", e);
    }

    return input;
}
```

## Get fulfillment preview
In order to get a fulfillment preview, you have to setup the API client accordingly, build the request body and finally get the fulfillment preview.

### Sample Code
Below you can find sample code for the get fulfillment preview operation.

#### Step-by-step:
1. **Set up the API client:** Initialize the FBA Outbound API client by providing refresh token and region code.
2. **Build the request body:** Build the `GetFulfillmentPreviewRequest` object and set all required data.
3. **Execute the call:** Get fulfillment preview by calling `getFulfillmentPreview` operation.

#### Java
*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/fulfillment-outbound/code/java/src/main/java/lambda/PreviewOrderHandler.java)*
```java
public MCFCreateOrderLambdaInput handleRequest(MCFCreateOrderLambdaInput input, Context context) {

    try {
        FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken());
        
        GetFulfillmentPreviewRequest getFulfillmentPreviewRequest = buildGetFulfillmentPreviewRequest(input.getCreateFulfillmentOrderNotification());

        GetFulfillmentPreviewResponse getFulfillmentPreviewResponse = fbaoApi.getFulfillmentPreview(getFulfillmentPreviewRequest);
    } catch (Exception e) {
        throw new InternalError("Calling GetFulfillmentPreview failed", e);
    }

    return input;
}

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
```