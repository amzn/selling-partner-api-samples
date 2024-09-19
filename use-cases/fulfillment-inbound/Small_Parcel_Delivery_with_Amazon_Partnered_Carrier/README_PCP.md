## Fulfillment Inbound API v2024-03-20

The Selling Partner API for Fulfillment By Amazon (FBA) Inbound. The FBA Inbound API enables building inbound workflows
to create, manage, and send shipments into Amazon's fulfillment network. The API has interoperability with the
Send-to-Amazon (STA) Seller Central User Interface.

If you haven't already, we recommend you to navigate the following resources:

- [Fulfillment Inbound API v2024-03-20 Reference](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference)
- [Fulfillment Inbound API v2024-03-20 Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide)

## Sample Solution

The **FBA Inbound Sample Solution App** provides all the necessary resources to deploy a fully functional SP-API
application that implements the new **Fulfillment By Amazon (FBA) Inbound API v2024-03-20** end-to-end.

This app is designed for sellers who want to automate the creation and management of inbound shipments using the new FBA
Inbound APIs. The flow targets **Small Parcel Delivery (SPD - individual boxes)** using **Amazon Partnered Carrier (PCP)
transportation option.**

### Key Features

- **Inbound Plan Creation:** Create inbound plans for shipping inventory, specifying SKUs and quantities.
- **Packing Selection:** Choose from available packing options to prepare your shipment.
- **Placement Selection:** Select the most cost-effective placement option for your inventory.
- **Transportation Carrier Selection:** Automatically select Amazon’s partnered carrier for small parcel delivery
  ensuring reliable and cost-effective shipping.
- **Shipping Labels and Tracking:** Generate necessary shipping labels for FBA boxes and carriers, and obtain tracking
  information to monitor shipment progress.

#### The app leverages AWS services such as Step Functions, Lambda Functions, SNS, and Secrets Manager to manage workflows, secure credentials, and handle failures efficiently.

### Sample Solution Structure

- **App Folder**: Contains the Step Function definitions, deployment templates, and scripts to deploy the infrastructure
  for the solution.

- **Code Folder**: Contains the **Java code** responsible for interacting with the FBA Inbound API. This includes sample
  inputs for creating shipments, handling labels, managing carrier information, and other features mentioned.

#### Use this application and source code to test the proposed solution, make modifications, and also integrate it into your own product.

## Workflow Overview

This workflow is defined using an AWS Step Function. Click to view the
full [Step Function Definition](app/step-functions/step-functions-workflow-definition.json).

| Step | API Operation                                                                                                                                                | Description                                                                                          | Lambda Handler                                                                                                               | Output                                             |
|------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------|
| 1.   | [Create Inbound Plan](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#createinboundplan)                         | Creates an inbound plan.                                                                             | [CreateInboundPlanLambdaHandler](code/java/src/main/java/lambda/CreateInboundPlanLambdaHandler.java)                         | inboundPlanId, operationId                         |
| 2.   | [Generate Packing Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#generatepackingoptions)               | Generates packing options.                                                                           | [GeneratePackingOptionsLambdaHandler](code/java/src/main/java/lambda/GeneratePackingOptionsLambdaHandler.java)               | operationId                                        |
| 3.   | [List Packing Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#listpackingoptions)                       | Lists the generated packing options and **chooses one of the options.**                              | [ListPackingOptionsLambdaHandler](code/java/src/main/java/lambda/ListPackingOptionsLambdaHandler.java)                       | packingOptionId, packingGroupId                    |
| 4.   | [Confirm Packing Option](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#confirmpackingoption)                   | Confirms the selected packing option.                                                                | [ConfirmPackingOptionLambdaHandler](code/java/src/main/java/lambda/ConfirmPackingOptionLambdaHandler.java)                   | operationId                                        |
| 5.   | [Set Packing Information](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#setpackinginformation)                 | Sets the box packing information.                                                                    | [SetPackingInformationLambdaHandler](code/java/src/main/java/lambda/SetPackingInformationLambdaHandler.java)                 | operationId                                        |
| 6.   | [Generate Placement Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#generateplacementoptions)           | Generates placement options.                                                                         | [GeneratePlacementOptionsLambdaHandler](code/java/src/main/java/lambda/GeneratePlacementOptionsLambdaHandler.java)           | operationId                                        |
| 7.   | [List Placement Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#listplacementoptions)                   | Lists the generated placement options and **chooses the cheapest option.**                           | [ListPlacementOptionsLambdaHandler](code/java/src/main/java/lambda/ListPlacementOptionsLambdaHandler.java)                   | shipmentId, placementOptionId                      |
| 8.   | [Generate Transportation Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#generatetransportationoptions) | Generates transportation options based on the **selected placement option.**                         | [GenerateTransportationOptionsLambdaHandler](code/java/src/main/java/lambda/GenerateTransportationOptionsLambdaHandler.java) | operationId                                        |
| 9.   | [List Transportation Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#listtransportationoptions)         | Lists the generated transportation options and **chooses the option with Amazon Partnered Carrier.** | [ListTransportationOptionsLambdaHandler](code/java/src/main/java/lambda/ListTransportationOptionsLambdaHandler.java)         | transportationOptionId                             |
| 10.  | [Confirm Placement Option](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#confirmplacementoption)               | Confirms the **chosen placement option** for the inbound plan.                                       | [ConfirmPlacementOptionLambdaHandler](code/java/src/main/java/lambda/ConfirmPlacementOptionLambdaHandler.java)               | operationId                                        |
| 11.  | [Confirm Transportation Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#confirmtransportationoptions)   | Confirms the **chosen transportation option** for the inbound plan.                                  | [ConfirmTransportationOptionsLambdaHandler](code/java/src/main/java/lambda/ConfirmTransportationOptionsLambdaHandler.java)   | operationId                                        |
| 12.  | [Get Shipment Details](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#getshipment)                              | Retrieves detailed shipment information.                                                             | [GetShipmentLambdaHandler](code/java/src/main/java/lambda/GetShipmentLambdaHandler.java)                                     | shipmentConfirmationId                             |
| 13.  | [Get Labels](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v0-reference#getlabels)                                                   | Retrieves the shipment labels and obtains a **download URL** notified via email.                     | [GetLabelsLambdaHandler](code/java/src/main/java/lambda/GetLabelsLambdaHandler.java)                                         | download URL via `LabelGeneratedSNSTopicArn` topic |

The POST operations are asynchronous. You need to check the status of each POST operation using
[OperationStatusLambdaHandler](code/java/src/main/java/lambda/OperationStatusLambdaHandler.java) by passing
the [operationId](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#getinboundoperationstatus). This is already covered in this sample solution workflow.

If the operation fails, `ShipmentCreationFailedSNSTopicArn` topic notifies failures and reasons to your email and the
workflow ends. Restart the workflow after correcting the failures !

For detailed requests and responses for API operations, refer to the **Lambda Log Group** in the **Events View.**
The Step Function uses Task, Wait, Choice, and Fail states to manage the workflow, handle retries, and determine the
next actions based on the status of each operation.

## Deployment Instructions

Refer to the Deployment Details File for step-by-step deployment instructions, including the pre-requisites,
configuration of
Lambda functions, Step Functions, and other AWS services. Ensure you follow these instructions before proceeding with
testing or modifying the sample solution.

- [Deployment File](docs/Deployment_Guide.md)

## Test the sample solution

The deployment script creates a Sample Solution App in the AWS cloud. The solution consists of
a [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional workflow.

To test the sample solution, follow the steps below.

### a. Start the Step Functions State Machine

1. Open the [AWS console](https://console.aws.amazon.com/).
2. Navigate to the [Step Functions console](https://console.aws.amazon.com/states/home).
3. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix.***
4. Click **Start execution** providing [Sample Solution JSON Input Structure](#sample-solution-json-input-structure).
5. The state machine execution will **Start.**

### b. Confirm SNS Subscriptions

1. Log in to your specified email inbox.
2. Look for an email with the subject **AWS Notification - Subscription Confirmation**.
3. Click **Confirm Subscription** for the following topics:

- **ShipmentCreationFailedSNSTopic**: For receiving failure notifications.
- **LabelGeneratedSNSTopic**: For receiving shipment labels.

### c. Monitor Execution

- Use the **Graph view** and **Step Detail** panels in the Step Functions console to monitor the state machine
  execution.

### d. Successful Execution

- If successful, the execution will create an inbound plan for the specified items, selecting Small Parcel Delivery (
  SPD) transported via Amazon Partnered Carrier.
- Shipment labels will be generated and sent to the provided email address.

### f. Failed Execution

- If the operation fails, `ShipmentCreationFailedSNSTopicArn` will notify to your email and the workflow ends. Restart
  the workflow after correcting the failures !

### Key Considerations

- This sample solution is designed for **Single Box with Single Item and Box Packing Info known upfront.** To handle
  multiple boxes and items, modify it accordingly. The API operations flow remains the same.

- The following attributes are handled as [constants](lambda/utils/Constants.java) in the workflow and should not be
  included in the JSON input:

```
QUANTITY = 1;                                         // Single Box and Single Item.
CONTENT_INFORMATION_SOURCE = "BOX_CONTENT_PROVIDED"; // Box contents have been provided by the seller.
```

> Inbound plans created through this workflow for testing should be cancelled within 24 hours to avoid incurring fees.
> You can use [cancelInboundPlan](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#put-inboundfba2024-03-20inboundplansinboundplanidcancellation).

### Sample Solution JSON Input Structure

The JSON input **MUST** follow the structure below. Replace placeholder values with actual data.

Valid **regionCode** values are NA, EU, FE. Refer
to [Marketplaces](https://developer-docs.amazon.com/sp-api/docs/marketplace-ids)
and [PageTypes](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v0-reference#pagetype) to input
right values.

```json
{
  "apiCredentials": {
    "refreshToken": "Atzr|Abc123def456xyz789",
    "regionCode": "NA"
  },
  "createInboundPlanRequest": {
    "destinationMarketplace": "ATVPDKIKX0DER",
    "msku": "XX-XXXX-XXXX",
    "labelOwner": "AMAZON or SELLER or NONE",
    "prepOwner": "AMAZON or SELLER or NONE",
    "sourceAddress": {
      "addressLine1": "xxx xxx",
      "addressLine2": "xxx",
      "city": "xxx",
      "stateOrProvinceCode": "xx",
      "countryCode": "xx",
      "postalCode": "xxxxx",
      "name": "Test",
      "phoneNumber": "xxxxxxxxxx",
      "companyName": "Testing",
      "email": "test@email.com"
    },
    "inboundPlanName": "SPD_PCP_TestInboundPlan"
  },
  "setPackingInformationRequest": {
    "weight": {
      "unit": "LB",
      "value": 1
    },
    "dimensions": {
      "unitOfMeasurement": "IN",
      "length": 5,
      "width": 5,
      "height": 5
    }
  },
  "generateTransportationOptionsRequest": {
    "readyToShipWindow": "yyyy-mm-ddT00:00:00Z"
  },
  "getLabelsRequest": {
    "PageType": "PackageLabel_Letter_2",
    "PageSize": 1,
    "LabelType": ""
  }
}
```