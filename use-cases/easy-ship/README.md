# Overview
This Sample Solution provides all required resources to deploy to the AWS cloud a fully functional SP-API application that implements the [Easy Ship API v2022-03-23 Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/easyship-api-v2022-03-23-use-case-guide) end-to-end.
Use this application to test the proposed solution, do changes and/or integrate it to your own product.

## EasyShip API
The Amazon EasyShip API is designed to support you build applications that help sellers manage and ship Amazon Easy Ship orders.
With these APIs, you can request below operations.
* Getting available time slots for packages to be scheduled for delivery
* Schedule, reschedule, and cancel Easy Ship orders
* Print labels, invoices, and warranties

If you haven't already, we recommend you to navigate the following resources:

* [Easy Ship API v2022-03-23 Reference](https://developer-docs.amazon.com/sp-api/docs/easy-ship-api-v2022-03-23-reference)
* [Easy Ship API v2022-03-23 Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/easyship-api-v2022-03-23-use-case-guide)

## Solution
This Sample Solution implements the following Easy Ship operations:
* [Retrieve an order](#retrieve-an-order)
* [Check Inventory](#check-inventory)
* [Get Handover Slots list](#get-handover-slots-list)
* [Create Schedule package with the preferred shipment handover slots](#create-schedule-package-with-the-preferred-shipment-handover-slots)
* [Confirm scheduled shipment by Scheduled Package Id](#confirm-scheduled-shipment-by-scheduled-package-id)
* [Submit Feed Request for printing shipping label](#submit-feed-request-for-printing-shipping-label)
* [Get Feed Document to identify document Report Reference Id](#get-feed-document-to-identify-document-report-reference-id)
* [Download shipping label from Report API and Store it to S3 then generate pre-signed URL](#download-shipping-label-from-report-api-and-store-it-to-s3-then-generate-pre-signed-url)

If you want to test the proposed solution, do changes and/or integrate it to your own product, follow the steps under [Deployment Guide](docs/DEPLOYMENT.md).

## Workflow

A well-architected Easy Ship workflow includes subscribing to the `ORDER_CHANGE` notification for automatic reception of new EasyShip orders.
Alternatively, new orders can be identified from incoming order reports.
Entire Workflow can be break into 2 parts below, EasyShip workflow and the Detail operation of Printing Label Workflow.
![EasyShip_Workflow](docs/images/EasyShip_Workflow.png)
![EasyShip_Print Label Workflow](docs/images/EasyShip_PrintLabel.png)

## Sample Code

Below are the code steps for the Easy Ship service workflow.

The process for the steps belows should start by monitoring [ORDER_CHANGE](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#order_change) notifications. To subscribe to the Notifications, refer to [Tutorial 5: Subscribe to MFN Notifications](https://developer-docs.amazon.com/sp-api/docs/merchant-fulfillment-api-v0-use-case-guide#tutorial-5-subscribe-to-mfn-notifications) of the use case guide.

### Retrieve an order

Upon an ORDER_CHANGE notification for unshipped MFN orders, the Orders API is used to retrieve the order details.

#### Step-by-step:
1. **Initialize API Client:** The API client of OrdersAPI is initialized with the Refresh Token and the Region.
2. **Get Order:** The Orders API getOrder operation is called using the orderId from the ORDER_CHANGE notification.
3. **Get Order Item:** The Orders API getOrderItems operation is called using the orderId from the ORDER_CHANGE notification.
4. **Confirm EasyShip order:** Confirm if the order is EasyShip order with right status using the Orders API getOrderResponse.
5. **Create the order processing class:** The EasyShipOrder class is instantiated with the order items from getOrderItems.
6. **Pass EasyShipOrder object** The EasyShipOrder object created is passed for further processing of the EasyShip Workflow.

**Java**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/easy-ship/code/java/src/main/java/lambda/RetrieveOrderHandler.java)*

```java
// Get Order V0 API instance
OrdersV0Api OrdersApi = ApiUtils.getOrdersV0Api(input);

// API calls to retrieve order and order items
GetOrderResponse orderResponse = OrdersApi.getOrder(input.getAmazonOrderId());
GetOrderItemsResponse orderItemsResponse = OrdersApi.getOrderItems(input.getAmazonOrderId(), null);

if (!EasyShipShipmentStatus.PENDINGSCHEDULE.equals(orderResponse.getPayload().getEasyShipShipmentStatus())) {
        throw new IllegalArgumentException(
        String.format("Amazon Order Id : %s is not EasyShip order", input.getAmazonOrderId()));
}

EasyShipOrder easyShipOrder = new EasyShipOrder();
easyShipOrder.setOrderItems(getOrderItemList(orderItemsResponse));

input.setEasyShipOrder(easyShipOrder);

return input;
```

### Check Inventory

After retrieving the order details, the system performs an inventory availability check and retrieves the dimension and weight information.

#### Step-by-step:
1. **Process the order items:** A loop over all order items is created to execute inventory checks.
2. **Prepare the request:** Get the orderItem SKU and prepare the database (DynamoDB) request.
3. **Retrieve the Item from Inventory:** Using the database client, the item is retrieved from inventory table.
4. **Check stock:** The item stock quantity is checked. The order is aborted if quantity is insufficient.
5. **Calculate Order Weight and Dimensions:** The total order weight and dimensions are calculated and returned as part of the EasyShip order.

Find the full code here

**Java**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/easy-ship/code/java/src/main/java/lambda/InventoryCheckHandler.java)*

```java
    // Iterate over all order items and retrieve stock, size and weight from the database
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
```

### Get Handover Slots list

Once the inventory is checked and Weight and Dimensions are retrieved, we use the [listHandoverSlots](https://developer-docs.amazon.com/sp-api/docs/easy-ship-api-v2022-03-23-reference#post-easyship2022-03-23timeslot) operation to check for available handover slots list.

#### Step-by-step:
1. **Initialize API Client:** The API client for EasyShip is initialized using the Refresh Token and the Region.
2. **Prepare the request:** The request for the listHandoverSlots operation is prepared.
3. **Call the API:** The EasySHip Api listHandoverSlots is called using the prepared request.
4. **Set the Handover slots list:** Set the fetched eligible Handover slots as part of the order and return it.

**Java**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/easy-ship/code/java/src/main/java/lambda/ListHandoverSlotsHandler.java)*

```java
    //Get list of handover shipment slot for the order
    ListHandoverSlotsRequest request = new ListHandoverSlotsRequest()
        .amazonOrderId(input.getAmazonOrderId())
        .marketplaceId(input.getMarketplaceId())
        .packageDimensions(input.getEasyShipOrder().getPackageDimensions())
        .packageWeight(input.getEasyShipOrder().getPackageWeight());

        logger.log("EasyShip API -  listHandoverSlots request: " + new Gson().toJson(request));

    EasyShipApi easyShipApi = ApiUtils.getEasyShipApi(input);
    ListHandoverSlotsResponse response = easyShipApi.listHandoverSlots(request);

    input.setTimeSlots((response.getTimeSlots()));
    return input;
```

### Create Schedule package with the preferred shipment handover slots

After getting the eligible Handover slots, Call [createScheduledPackage](https://developer-docs.amazon.com/sp-api/docs/easy-ship-api-v2022-03-23-reference#post-easyship2022-03-23package) operation to create a schedule with preferred shipment handover slots.

#### Step-by-step:
1. **Prepare the request:** Create CreateScheduledPackageRequest with the preferred shipment handover slots.
2. **Initialize API Client:** The API client for EasyShip is initialized using the Refresh Token and the Region.
3. **Return Scheduled Package Id:** The Scheduled Package Id is returned for confirmation step coming to next.

**Java**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/easy-ship/code/java/src/main/java/lambda/CreateScheduledPackageHandler.java)*

```java
    //Get list of handover shipment slot for the order
    CreateScheduledPackageRequest request = new CreateScheduledPackageRequest()
        .amazonOrderId(input.getAmazonOrderId())
        .marketplaceId(input.getMarketplaceId())
        .packageDetails(new PackageDetails()
                .packageTimeSlot(input.getTimeSlots().get(0)));

    logger.log("EasyShip API -  CreateScheduledPackage request: " + new Gson().toJson(request));

    EasyShipApi easyShipApi = ApiUtils.getEasyShipApi(input);
    ModelPackage response = easyShipApi.createScheduledPackage(request);
    logger.log("EasyShip API -  CreateScheduledPackage response: " + new Gson().toJson(response));

    // Store ScheduledPackageId to validate scheduled correctly using this information on the next step
    input.setScheduledPackageId(response.getScheduledPackageId());
    return input;
```

### Confirm scheduled shipment by Scheduled Package Id

After creating schedule package on EasyShip, confirm schedule was created as expected by calling [getScheduledPackage](https://developer-docs.amazon.com/sp-api/docs/easy-ship-api-v2022-03-23-reference#get-easyship2022-03-23package) operation.
Note that, this step was added for making sure, so it can be skipped if not needed.

#### Step-by-step:
1. **Initialize API Client:** The EasyShip API is initialized using the Refresh Token and the Region.
2. **Call the getScheduledPackage operation** The getScheduledPackage operation is called using Amazon Order Id and Market Place Id.
3. **Validate Scheduled Package Id:** Confirm the Scheduled Package Id part of the response payload is same as the Scheduled Package Id from previous step.

**Java**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/easy-ship/code/java/src/main/java/lambda/GetScheduledPackageHandler.java)*

```java
    EasyShipApi easyShipApi = ApiUtils.getEasyShipApi(input);
    ModelPackage response = easyShipApi.getScheduledPackage(input.getAmazonOrderId(), input.getMarketplaceId());
    logger.log("EasyShip API -  CreateScheduledPackage response: " + new Gson().toJson(response));
    // Validate if scheduled correctly using ScheduledPackageId
    if (!response.getScheduledPackageId().equals(input.getScheduledPackageId())) {
        throw new IllegalArgumentException(
        String.format("Amazon Order Id : %s was not scheduled correctly", input.getAmazonOrderId()));
    }
```

### Submit Feed Request for printing shipping label

After creating scheduled package, start printing the shipping label process starting calling Feed API.
Detailed instruction can be found [Tutorial: Get shipping labels, invoice, and warranty documents](https://developer-docs.amazon.com/sp-api/docs/easyship-api-v2022-03-23-use-case-guide#tutorial-get-shipping-labels-invoice-and-warranty-documents).

#### Step-by-step:
1. **Initialize API Client:** The Feed API is initialized using the Refresh Token and the Region.
2. **Call Create Feeds document API:** The [createFeedDocument](https://developer-docs.amazon.com/sp-api/docs/feeds-api-v2021-06-30-reference#post-feeds2021-06-30documents) operation needs to be called to generate feedDocumentId and url for storing Feed Document.
3. **Prepare Feed Document** Create a Feed document which will be uploaded to the url was given at the previous step.
4. **Upload Feed Document:** Upload Feed document just created using Http PUT method with give credentials at the Create Feeds document API response.
5. **Call Create Feeds API:** After upload feed document, execute Feed process by calling [createFeed](https://developer-docs.amazon.com/sp-api/docs/feeds-api-v2021-06-30-reference#post-feeds2021-06-30feeds) operation.

**Java**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/easy-ship/code/java/src/main/java/lambda/SubmitFeedRequestHandler.java)*

```java
    // Create Feeds document
    FeedsApi feedsApi = ApiUtils.getFeedsApi(input);
    String contentType = String.format("text/xml; charset=%s", StandardCharsets.UTF_8);
    CreateFeedDocumentSpecification createFeedDocumentbody = new CreateFeedDocumentSpecification().contentType(contentType);
    CreateFeedDocumentResponse createFeedDocumentresponse = feedsApi.createFeedDocument(createFeedDocumentbody);
    logger.log("Feed API -  Create Feeds document response: " + new Gson().toJson(createFeedDocumentresponse));
    
    // Upload Feeds Document
    String url = createFeedDocumentresponse.getUrl();
    String content = XmlUtil.generateEasyShipAmazonEnvelope(
            input.getSellerId(),input.getAmazonOrderId(), FEED_OPTIONS_DOCUMENT_TYPE_VALUE);
            HttpFileTransferUtil.upload(content.getBytes(StandardCharsets.UTF_8), url);
            
    // Create Feeds
    FeedOptions feedOptions = new FeedOptions();
    feedOptions.put(FEED_OPTIONS_KEY_AMAZON_ORDER_ID, input.getAmazonOrderId());
    feedOptions.put(FEED_OPTIONS_KEY_DOCUMENT_TYPE, FEED_OPTIONS_DOCUMENT_TYPE_VALUE);
    String feedDocumentId = createFeedDocumentresponse.getFeedDocumentId();
    CreateFeedSpecification createFeedbody = new CreateFeedSpecification()
            .feedType(POST_EASYSHIP_DOCUMENTS)
            .marketplaceIds(Collections.singletonList(input.getMarketplaceId()))
            .feedOptions(feedOptions)
            .inputFeedDocumentId(feedDocumentId);
    logger.log("Feed API -  Create Feeds  request body: " + new Gson().toJson(createFeedbody));
    CreateFeedResponse createFeedResponse = feedsApi.createFeed(createFeedbody);
    logger.log("Feed API -  Create Feeds  response: " + new Gson().toJson(createFeedDocumentresponse));
    input.setFeedId(createFeedResponse.getFeedId());
    return input;
```

### Get Feed Document to identify document Report Reference Id

After creating the Feed request, wait until the Feed process is completed by confirming its status via the [getFeed](https://developer-docs.amazon.com/sp-api/docs/feeds-api-v2021-06-30-reference#get-feeds2021-06-30feedsfeedid) operation.
Then call [getFeedDocument](https://developer-docs.amazon.com/sp-api/docs/feeds-api-v2021-06-30-reference#get-feeds2021-06-30documentsfeeddocumentid) operation to download and see the result of the Feed process.

#### Step-by-step:
1. **Initialize API Client:** The Feed API is initialized using the Refresh Token and the Region.
2. **Call Get Feeds API:** The [getFeed](https://developer-docs.amazon.com/sp-api/docs/feeds-api-v2021-06-30-reference#get-feeds2021-06-30feedsfeedid) operation is called to retrieve resultFeedDocumentId which will be used to download result file at the next step.
3. **Call Get Feeds Document API:** The [getFeedDocument](https://developer-docs.amazon.com/sp-api/docs/feeds-api-v2021-06-30-reference#get-feeds2021-06-30documentsfeeddocumentid) operation is called using resultFeedDocumentId to retrieve result file URL.
4. **Download Feeds Result Document:** Download Feeds Result Document via Http GET method with give credentials from the Get Feeds Document API response.
5. **Return Document Report Reference Id:** The documentReportReferenceId is returned from the downloaded Feeds Result Document.

**Java**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/easy-ship/code/java/src/main/java/lambda/GetFeedDocumentHandler.java)*

```java
    //Initialize API Client
    FeedsApi feedsApi = ApiUtils.getFeedsApi(input);

    // Get Feeds
    String resultFeedDocumentId = waitForFeedCompletion(feedsApi, input.getFeedId(), logger);
    
    // Get Feed Document
    FeedDocument document = getFeedDocument(feedsApi, resultFeedDocumentId, logger);
    
    // Download Document
    InputStream documentStream = HttpFileTransferUtil.download(document.getUrl(), null);
    
    // Extract documentReportReferenceId from the document
    String documentReportReferenceId = XmlUtil.getXmlDocumentTag(documentStream, FEED_DOCUMENT_REPORT_REFERENCE_ID);
    input.setReportId(documentReportReferenceId);

    return input;
```

### Download shipping label from Report API and Store it to S3 then generate pre-signed URL

After identifying documentReportReferenceId by downloading Feeds Result Document, 
call [getReport](https://developer-docs.amazon.com/sp-api/docs/reports-api-v2021-06-30-reference#get-reports2021-06-30reportsreportid) API to identify reportDocumentId,
then call [getReportDocument](https://developer-docs.amazon.com/sp-api/docs/reports-api-v2021-06-30-reference#get-reports2021-06-30documentsreportdocumentid) API to identify URL of generated document,
download the document, store it in S3 and generate pre-signed URL which will be send as E-mail content.

#### Step-by-step:
1. **Initialize API Client:** The Report API is initialized using the Refresh Token and the Region.
2. **Call Get Report API:** The [getReport](https://developer-docs.amazon.com/sp-api/docs/reports-api-v2021-06-30-reference#get-reports2021-06-30reportsreportid) operation is called to retrieve reportDocumentId which will be used to identify URL of the Report document at the next step.
3. **Call Get Report Document API:** The [getReportDocument](https://developer-docs.amazon.com/sp-api/docs/reports-api-v2021-06-30-reference#get-reports2021-06-30documentsreportdocumentid) operation is called using reportDocumentId to retrieve the Report document URL.
4. **Download Report Document:** Download the Report Document via Http GET method with give credentials from the Get Report Document API response.
5. **Store Report Document into S3:** Store downloaded file into S3 bucket.
6. **Pre-sign:** A pre-signed URL is generated on the label object on S3.

**Java**

*Find the full code [here](https://github.com/amzn/selling-partner-api-samples/blob/main/use-cases/easy-ship/code/java/src/main/java/lambda/GetReportDocumentHandler.java)*

```java
    //Initialize API Client
    ReportsApi reportsApi = ApiUtils.getReportsApi(input);
    
    // Get reportDocumentId from ReportAPI
    String reportDocumentId = waitForReportCompletion(reportsApi, input, logger);
    
    // Get Report Document
    String documentUrl = getReportDocumentUrl(reportsApi, reportDocumentId, logger);
    
    // Download Report Document
    InputStream documentStream = HttpFileTransferUtil.download(documentUrl, null);
    // Get S3 bucket name from environment variables
    String s3BucketName = System.getenv(EASYSHIP_LABEL_S3_BUCKET_NAME_ENV_VARIABLE);
    // Generate S3 key for the document
    String objectKey = generateObjectKey(input);
    logger.log("S3 Bucket Name: " + s3BucketName + " S3 Object Key: " + objectKey);

    //Store into S3 bucket
    storeDocumentInS3(s3BucketName, objectKey, documentStream);
    
    //Generate a presigned url to browse the label
    return generatePresignedUrl(s3BucketName, objectKey, logger);
```

The pre-signed URL is finally passed to next steps such as printing.
In this sample solution, the step functions last step provides the pre-signed URl to an SNS topic which triggers then sends it by Email.  