## Fulfillment Inbound API v2024-03-20

The Selling Partner API for Fulfillment By Amazon (FBA) Inbound. The FBA Inbound API enables building inbound workflows to create, manage, and send shipments into Amazon's fulfillment network. The API has interoperability with the Send-to-Amazon (STA) Seller Central User Interface.

If you haven't already, we recommend you to navigate the following resources:

- [Fulfillment Inbound API v2024-03-20 Reference](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference)
- [Fulfillment Inbound API v2024-03-20 Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide)
- [Fulfillment Inbound API v2024-03-20 Code Samples](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-code-samples)

## Sample Solution

The **FBA Inbound Sample Solution App** provides all the necessary resources to deploy a fully functional SP-API application that implements the new **Fulfillment By Amazon (FBA) Inbound API v2024-03-20** end-to-end.

This app is designed for sellers who want to automate the creation and management of inbound shipments using the new FBA Inbound APIs. The flow targets **Pallet (LTL/FTL) Delivery** using a **Non-Partnered Carrier (nPCP) transportation option** when the seller **doesn't know carton information upfront (Pack Later) at the start of the process**, allowing sellers to have flexible packing decisions later in the workflow.

### Key Features

- **Inbound Plan Creation:** Create inbound plans with defined SKU items and quantities.
- **Placement Selection:** Generate, list and choose the cheapest placement option.
- **Packing Selection:** Provide information related to what items will be packed into boxes per shipment.
- **Delivery Window and Transportation Carrier Selection:** Choose a delivery window, then select a non-partnered carrier for pallet (LTL/FTL) delivery.
- **Shipping Details and Labels:** Provide comprehensive shipping details and generate FBA box/pallet labels.
- **Update Tracking:** Update Amazon with the tracking information provided by your carrier for seamless tracking andmanagement.

#### The app leverages AWS services such as Step Functions, Lambda Functions, SNS, and Secrets Manager to manage workflows, secure credentials, and handle failures efficiently.

### Sample Solution Structure

- **App Folder**: Contains the Step Function definitions, deployment templates, and scripts to deploy the infrastructure
  for the solution.

- **Code Folder**: Contains the **Java code** responsible for interacting with the FBA Inbound API. This includes sample
  inputs for creating shipments, handling labels, managing carrier information, and other features mentioned.

#### Use this application and source code to test the proposed solution, make modifications, and also integrate it into your own product.

## Workflow Overview

This sample solution consists of 2 workflows:

1. **Create and Manage Pack Later Inbound Plan:** To create and manage inbound plan choosing Pallet (LTL/FTL) mode and your own transportation carrier with Pack Later Flow.
2. **Update Tracking IDs:** To update tracking IDs provided by your carrier to Amazon.
---
### Workflow 1: Overview of Create and Manage Pack Later Inbound Plan workflow top-down
This workflow is defined using an AWS Step Function. Click to view the full [Step Function Definition](app/step-functions/step-functions-workflow-definition.json).

| Step | API Operation                                                                                                                                                 | Description                                                                                                   | Lambda Handler                                                                                                               | Output                                           |
|------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------|
| 1.   | [Create Inbound Plan](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#createinboundplan)                          | Creates an inbound plan.                                                                                      | [CreateInboundPlanLambdaHandler](code/java/src/main/java/lambda/CreateInboundPlanLambdaHandler.java)                         | inboundPlanId, operationId                       |
| 2.   | [Generate Placement Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#generateplacementoptions)            | Generates placement options.                                                                                  | [GeneratePlacementOptionsLambdaHandler](code/java/src/main/java/lambda/GeneratePlacementOptionsLambdaHandler.java)           | operationId                                      |
| 3.   | [List Placement Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#listplacementoptions)                    | Lists the generated placement options and **chooses the cheapest option.**                                    | [ListPlacementOptionsLambdaHandler](code/java/src/main/java/lambda/ListPlacementOptionsLambdaHandler.java)                   | shipmentId, placementOptionId                    |
| 4.  | [Confirm Placement Option](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#confirmplacementoption)                | Confirms the **chosen placement option** for the inbound plan.                                                | [ConfirmPlacementOptionLambdaHandler](code/java/src/main/java/lambda/ConfirmPlacementOptionLambdaHandler.java)               | operationId                                      |
| 5.   | [Set Packing Information](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#setpackinginformation)                  | Sets the box packing information.                                                                             | [SetPackingInformationLambdaHandler](code/java/src/main/java/lambda/SetPackingInformationLambdaHandler.java)                 | operationId                                      |
| 6.   | [Generate Transportation Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#generatetransportationoptions)  | Generates transportation options based on the **selected placement option.**                                  | [GenerateTransportationOptionsLambdaHandler](code/java/src/main/java/lambda/GenerateTransportationOptionsLambdaHandler.java) | operationId                                      |
| 7.   | [Generate Delivery Window Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#generatedeliverywindowoptions) | Generates available delivery window options.                                                                  | [GenerateDeliveryWindowOptionsLambdaHandler](code/java/src/main/java/lambda/GenerateDeliveryWindowOptionsLambdaHandler.java) | operationId                                      |
| 8.  | [List Transportation Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#listtransportationoptions)          | Lists the generated transportation options and **chooses the first option with Pallet and your own carrier.** | [ListTransportationOptionsLambdaHandler](code/java/src/main/java/lambda/ListTransportationOptionsLambdaHandler.java)         | transportationOptionId                           |
| 9.  | [List Delivery Window Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#listdeliverywindowoptions)         | Lists the generated delivery window options and **chooses the window with the latest endDate.**               | [ListDeliveryWindowOptionsLambdaHandler](code/java/src/main/java/lambda/ListDeliveryWindowOptionsLambdaHandler.java)         | deliveryWindowOptionId                           |
| 10.  | [Confirm Delivery Window Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#confirmdeliverywindowoptions)   | Confirms the **chosen delivery window option** for the inbound plan.                                          | [ConfirmDeliveryWindowOptionsLambdaHandler](code/java/src/main/java/lambda/ConfirmDeliveryWindowOptionsLambdaHandler.java)   | operationId                                      |
| 11.  | [Confirm Transportation Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#confirmtransportationoptions)    | Confirms the **chosen transportation option** for the inbound plan.                                           | [ConfirmTransportationOptionsLambdaHandler](code/java/src/main/java/lambda/ConfirmTransportationOptionsLambdaHandler.java)   | operationId                                      |
| 12.  | [Get Shipment Details](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#getshipment)                               | Retrieves detailed shipment information.                                                                      | [GetShipmentLambdaHandler](code/java/src/main/java/lambda/GetShipmentLambdaHandler.java)                                     | shipmentConfirmationId                           |
| 13.  | [Get Labels](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v0-reference#getlabels)                                                    | Retrieves the shipment labels and obtains a **download URL** notified via email.                              | [GetLabelsLambdaHandler](code/java/src/main/java/lambda/GetLabelsLambdaHandler.java)                                         | download URL via LabelGeneratedSNSTopicArn topic |

The POST operations are asynchronous. You need to check the status of each POST operation using [OperationStatusLambdaHandler](code/java/src/main/java/lambda/OperationStatusLambdaHandler.java) by passing the [operationId](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#getinboundoperationstatus). This is already covered in this sample solution workflow.

If the operation fails, the workflow fails with the failure reason stated in the Step Function Console. Restart the workflow after correcting the failures !

For detailed requests and responses for API operations, refer to the **Lambda Log Group** in the **Events View.** The Step Function uses Task, Wait, Choice, and Fail states to manage the workflow, handle retries, and determine the next actions based on the status of each operation.

---

### Workflow 2: Overview of Update Tracking IDs workflow top-down

Click to view the full [Step Function Definition](app/step-functions/step-functions-updateShipmentTracking-workflow-definition.json).

| Step | API Operation                                                                                                                                                 | Description                                                          | Lambda Handler                                                                                                               | Output      |
|------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|-------------|
| 1.   | [Update Shipment Tracking Details](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#updateshipmenttrackingdetails) | Updates Shipment Tracking Details for inbound shipment.              | [UpdateShipmentTrackingDetailsLambdaHandler](code/java/src/main/java/lambda/UpdateShipmentTrackingDetailsLambdaHandler.java) | operationId |

Status of Update Shipment Tracking operation will be tracked using [OperationStatusLambdaHandler](code/java/src/main/java/lambda/OperationStatusLambdaHandler.java) using the operationId. This is already covered in this sample solution workflow.

If the operation fails, the workflow fails with the failure reason stated in the Step Function Console. Restart the workflow after correcting the failures !

---

## Deployment Instructions

Refer to the Deployment Details File for step-by-step deployment instructions, including the pre-requisites, configuration of Lambda functions, Step Functions, and other AWS services. Ensure you follow these instructions before proceeding with testing or modifying the sample solution.

- [Deployment File](docs/Deployment_Guide.md)

## Test the sample solution

The deployment script creates a Sample Solution App in the AWS cloud. The solution consists of a [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional workflow.

To test the sample solution, follow the steps below.

---

### Start the Step Functions State Machine

1. Open the [AWS console](https://console.aws.amazon.com/).
2. Navigate to the [Step Functions console](https://console.aws.amazon.com/states/home).
3. The deployment script creates three workflows named as follows:

- **SPAPIStateMachine-*random_suffix:*** Create and Manage Pack Later Inbound Plan
- **SPAPITrackingDetailsStateMachine-*random_suffix:*** Update Tracking IDs

---

### Steps for Workflow 1: Create and Manage Pack Later Inbound Plan

#### a. Select the State Machine

- Choose the **SPAPIStateMachine-*random_suffix*** state machine.

#### b. Start Execution

- Click **Start execution**
  providing [Create Inbound Plan JSON Input Structure](#create-inbound-plan-json-input-structure).
- The state machine execution will **Start.**

#### c. Monitor Execution

- Use the **Graph view** and **Step Detail** panels in the Step Functions console to monitor the state machine execution.

#### d. Confirm SNS Subscriptions

- Log in to your specified email inbox.
- Look for an email with the subject **AWS Notification - Subscription Confirmation**.
- Click **Confirm Subscription** for the following topic:
  - **LabelGeneratedSNSTopic**: For receiving shipment labels.

#### e. Successful Execution

- If successful, the execution will create an inbound plan for the specified items, selecting Pallet (LTL/FTL) delivery option transported via your own carrier using the Pack Later flow.
- Shipment labels will be generated and sent to the provided email address.

#### f. Failed Execution

- If the operation fails, the workflow fails with the failure reason stated in the Step Function Console. Restart the workflow after correcting the failures !

#### Once you have the inbound plan confirmed and labels generated from workflow 1 proceed to Workflow 2 to update the tracking IDs.

---

### Steps for Workflow 2: Update Tracking IDs

#### a. Select the State Machine

- Choose the **SPAPITrackingDetailsStateMachine-*random_suffix*** state machine.

#### b. Start Execution

- Click **Start execution** providing [Update Tracking JSON Input Structure](#update-tracking-json-input-structure).
- The state machine execution will **Start.**

#### c. Monitor Execution

- Use the **Graph view** and **Step Detail** panels in the Step Functions console to monitor the state machine execution.

#### e. Successful Execution

- A successful execution will update Amazon with the tracking IDs provided by your carrier.

#### f. Failed Execution

- If the operation fails, the workflow fails with the failure reason stated in the Step Function Console. Restart the workflow after correcting the failures !

---

### Key Considerations

- This sample solution is designed for **Single Box/Single Pallet with Single Item and Carton Information not known upfront.** To handle multiple boxes, items and pallets, modify it accordingly. The API operations flow remains the same.

- The following attributes are handled as [constants](code/java/src/main/java/lambda/utils/Constants.java) in the workflow and should not be included in the JSON input:

```
QUANTITY = 1;                                         // Single Box, Single Item and Single Pallet.
CONTENT_INFORMATION_SOURCE = "BOX_CONTENT_PROVIDED"; // Box contents have been provided by the seller.
PAGE_SIZE = 20;
```
---

### Create Inbound Plan JSON Input Structure

The JSON input **MUST** follow the structure below. Replace placeholder values with actual data.

Valid **regionCode** values are NA, EU, FE. Refer to [Marketplaces](https://developer-docs.amazon.com/sp-api/docs/marketplace-ids) and [PageTypes](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v0-reference#pagetype) to input right values.

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
    "inboundPlanName": "Pallet_Pack_Later_TestPlan"
  },
  "setPackingInformationRequest": {
    "boxWeight": {
      "unit": "LB",
      "value": 1
    },
    "boxDimensions": {
      "unitOfMeasurement": "IN",
      "length": 20,
      "width": 20,
      "height": 20
    }
  },
  "generateTransportationOptionsRequest": {
    "readyToShipWindow": "yyyy-mm-ddT00:00:00Z",
    "contactInformation": {
      "name": "TestName",
      "phoneNumber": "1234567890",
      "email": "test@email.com"
    },
    "freightInformation": {
      "declaredValue": {
        "amount": 10,
        "code": "USD"
      },
      "freightClass": "FC_XX"
    },
    "palletDimensions": {
      "unitOfMeasurement": "IN",
      "length": 40,
      "width": 40,
      "height": 40
    },
    "stackability": "STACKABLE",
    "palletWeight": {
      "unit": "LB",
      "value": 20
    }
  },
  "getLabelsRequest": {
    "PageType": "PackageLabel_A4_4",
    "PageSize": 4,
    "NumberOfPallets": 1,
    "LabelType": ""
  }
}
```

### Update Tracking JSON Input Structure

```json
{
  "apiCredentials": {
    "refreshToken": "Atzr|Abc123def456xyz789",
    "regionCode": "NA"
  },
  "updateShipmentTrackingRequest": {
    "inboundPlanId": "wfxxxxxxxxxxxxxxxxxxx",
    "shipmentId": "shxxxxxxxxxxxxxxxxxxxx",
    "freightBillNumber": "xxxxxx"
  }
}
```
