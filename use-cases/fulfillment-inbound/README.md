## Overview

The Sample Solution App provides all required resources to deploy a fully functional SP-API application that implements
the new **Fulfillment By Amazon (FBA) Inbound API v2024-03-2024** for **Small Parcel Delivery flow using Amazon
Partnered Carrier transportation option end-to-end flow** using all the required API Operations.

> Use this application to test the proposed solution, do changes and/or integrate it to your own product.

#### The inbound plan created through this workflow for test has to be cancelled within 24-hours to avoid fee. You can use [cancelInboundPlan](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#put-inboundfba2024-03-20inboundplansinboundplanidcancellation).

## Fulfillment Inbound API v2024-03-20

The Selling Partner API for Fulfillment By Amazon (FBA) Inbound. The FBA Inbound API enables building inbound workflows
to create, manage, and send shipments into Amazon's fulfillment network. The API has interoperability with the
Send-to-Amazon (STA) Seller Central User Interface.

If you haven't already, we recommend you to navigate the following resources:

- [Fulfillment Inbound API v2024-03-20 Reference](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference)
- [Fulfillment Inbound API v2024-03-20 Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide)

## Solution

This Sample Solution provides a comprehensive workflow for creating and managing inbound plans to ship inventory
to Amazon's fulfillment network, where Amazon can fulfill your customer's orders. This workflow works when you are
sending your shipments as **Small Parcel Delivery (SPD - individual boxes) and use Amazon Partnered Carrier (PCP)
as shipping solution.**

> This sample solution works for Single Box, Single Item Inbound Shipping. Scale the code to handle multiple boxes and
> items.

The solution consists of the following AWS Services:

* [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional Fulfillment Inbound
  v2024 SPS PCP Workflow.
* [Lambda Functions](https://aws.amazon.com/lambda/) that support each of the steps of the state machine. Each Lambda
  function represents an API Operation.
* [Simple Notification Service (SNS)](https://aws.amazon.com/sns/) to notify below,
    * Failure in any of the workflow operations.
    * Notify and share the generated shipment box labels via email.
* [Secrets Manager](https://aws.amazon.com/secrets-manager/) secret to securely store SP-API app credentials.

## Workflow

Note that the POST operations are asynchronous. **You need to check the status of each POST operation using
OperationStatusLambdaHandler by passing the [operationId](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#getinboundoperationstatus).** This is already covered in this sample solution workflow.

If the operation fails, `ShipmentCreationFailedSNSTopicArn` topic notifies failures and reasons to your email and
workflow ends. Restart after correcting the failures !

You start by providing the JSON Input containing required parameters for API Operations. Below is the overview of the
workflow top-down,

| Step | API Operation                                                                                                                                                | Description                                                                                          | Lambda Handler                             | Output                                           |
|------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|--------------------------------------------|--------------------------------------------------|
| 1.   | [Create Inbound Plan](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#createinboundplan)                         | Creates an inbound plan.                                                                             | CreateInboundPlanLambdaHandler             | inboundPlanId, operationId                       |
| 2.   | [Generate Packing Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#generatepackingoptions)               | Generates packing options.                                                                           | GeneratePackingOptionsLambdaHandler        | operationId                                      |
| 3.   | [List Packing Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#listpackingoptions)                       | Lists the generated packing options and **chooses one of the option.**                               | ListPackingOptionsLambdaHandler            | packingOptionId, packingGroupId                  |
| 4.   | [Confirm Packing Option](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#confirmpackingoption)                   | Confirms the selected packing option.                                                                | ConfirmPackingOptionLambdaHandler          | operationId                                      |
| 5.   | [Set Packing Information](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#setpackinginformation)                 | Sets the box packing information.                                                                    | SetPackingInformationLambdaHandler         | operationId                                      |
| 6.   | [Generate Placement Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#generateplacementoptions)           | Generates placement options.                                                                         | GeneratePlacementOptionsLambdaHandler      | operationId                                      |
| 7.   | [List Placement Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#listplacementoptions)                   | Lists the generated placement options and **chooses the cheapest option.**                           | ListPlacementOptionsLambdaHandler          | shipmentId, placementOptionId                    |
| 8.   | [Generate Transportation Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#generatetransportationoptions) | Generates transportation options based on the **selected placement option.**                         | GenerateTransportationOptionsLambdaHandler | operationId                                      |
| 9.   | [List Transportation Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#listtransportationoptions)         | Lists the generated transportation options and **chooses the option with Amazon Partnered Carrier.** | ListTransportationOptionsLambdaHandler     | transportationOptionId                           |
| 10.  | [Confirm Placement Option](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#confirmplacementoption)               | Confirms the **chosen placement option** for the inbound plan.                                       | ConfirmPlacementOptionLambdaHandler        | operationId                                      |
| 11.  | [Confirm Transportation Options](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#confirmtransportationoptions)   | Confirms the **chosen transportation option** for the inbound plan.                                  | ConfirmTransportationOptionsLambdaHandler  | operationId                                      |
| 12.  | [Get Shipment Details](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#getshipment)                              | Retrieves detailed shipment information.                                                             | GetShipmentLambdaHandler                   | shipmentConfirmationId                           |
| 13.  | [Get Labels](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v0-reference#getlabels)                                                   | Retrieves the shipment labels and obtains a **download URL** notified via email.                     | GetLabelsLambdaHandler                     | download URL via LabelGeneratedSNSTopicArn topic |

For detailed requests and responses for API operations, refer to the **Lambda Log Group** in the **Events View.**
Throughout these steps, the step function uses various states including Task, Wait, Choice, and Fail to manage the
workflow, handle retries, and determine the next actions based on the status of each operation. This ensures that each
stage of the inbound shipment creation process is completed successfully.

#### After confirming the transportation request, the inbound plan created has to be cancelled within 24-hours to avoid fees. You can use [cancelInboundPlan](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference#put-inboundfba2024-03-20inboundplansinboundplanidcancellation).

## Pre-requisites

The pre-requisites for deploying the FBA Inbound Sample Solution App to the AWS cloud are:

1. [Registering as a Developer for SP-API](https://developer-docs.amazon.com/sp-api/docs/registering-as-a-developer)
   and [Registering an SP-API application](https://developer-docs.amazon.com/sp-api/docs/registering-your-application).
2. [FBA Inbound v2024 prerequisites.](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide#prerequisites)
3. [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) with permissions to create a new user, a
   policy, and attach it to the user.
    * If you don't have one, you can create it following the steps under **Usage - 2. Configure Sample Solution App's
      IAM user.**
4. [AWS CLI](https://aws.amazon.com/cli/)
    * If not present, it will be installed as part of the deployment script.
5. [Maven](https://maven.apache.org/)
    * Just for deploying a Java-based application.
    * If not present, it will be installed as part of the deployment script.
6. [GitBash](https://git-scm.com/download/win)
    * In case you use Windows in order to run the deployment script.

## Usage

### 1. Update config file

To allow the Sample Solution App to connect to SP-API, the config file has to be updated to match the set-up of your
SP-API application.

#### Open [app.config](app/app.config) file and replace all occurrences of `<dev_value>` following the instructions below,

* Update `ClientId` and `ClientSecret` attribute values with
  [Client Id and Client Secret of the SP-API application](https://developer-docs.amazon.com/sp-api/docs/viewing-your-application-information-and-credentials)
  respectively.

* Update `Email` with email ID where you want to get the shipment labels and operation failure details.

> Note: While updating the config file, don't leave blank spaces before and after `=`, and don't use quotation marks

#### Sample config file,

```
ClientId=amzn1.application-oa2-client.abc123def456xyz789
ClientSecret=amzn1.oa2-cs.v1.abc123def456xyz789
Email=test@test.com
```

### 2. Configure Sample Solution App's IAM user

#### I. Create IAM policy

In order to execute the deployment script, an IAM user with the appropriate permissions is needed. To create a new IAM
policy with the required permissions, follow the steps below,

1. Open the [AWS console](https://us-east-1.console.aws.amazon.com/console/home?region=us-east-1).
2. Navigate to [IAM Policies console](https://us-east-1.console.aws.amazon.com/iamv2/home#/policies).
3. Click **Create policy.**
4. Next to **Policy editor**, select **JSON** and replace the default policy with the JSON below. Make sure to
   replace `<aws_account_id_number>` your AWS account id number.

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "SPAPIAppIAMPolicy",
            "Effect": "Allow",
            "Action": [
                "iam:CreateUser",
                "iam:DeleteUser",
                "iam:CreatePolicy",
                "iam:DeletePolicy",
                "iam:AttachUserPolicy",
                "iam:DetachUserPolicy",
                "iam:CreateAccessKey",
                "iam:DeleteAccessKey"
            ],
            "Resource": [
                "arn:aws:iam::<aws_account_id_number>:user/*",
                "arn:aws:iam::<aws_account_id_number>:policy/*"
            ]
        }
    ]
 }
```

5. Click **Next.**
6. Select a name for your policy. Take note of this value as you will need it in the next section.
7. Review the changes and click **Create policy.**

#### II. Create IAM user

To create a new IAM user with the required permissions, follow the steps below,

1. Open the [AWS console](https://us-east-1.console.aws.amazon.com/console/home?region=us-east-1).
2. Navigate to [IAM Users console](https://us-east-1.console.aws.amazon.com/iamv2/home?region=us-east-1#/users).
3. Click **Create user.**
4. Select a name for your user.
5. In the **Set permissions** page, select **Attach policies directly.**
6. In the **Permissions policies,** search for the policy created in **I. Create IAM policy** section. Select the
   policy, and click **Next.**
7. Review the changes and click **Create user.**

#### III. Retrieve IAM user credentials

Security credentials for the IAM user will be requested during the deployment script execution. To create a new access
key pair, follow the steps below.
If you already have valid access key and secret access key, you can skip this section.

1. Open the [AWS console](https://us-east-1.console.aws.amazon.com/console/home?region=us-east-1).
2. Navigate to [IAM Users console](https://us-east-1.console.aws.amazon.com/iamv2/home?region=us-east-1#/users).
3. Select your IAM user created in **II. Create IAM user.**
4. Go to **Security credentials** tab.
5. Under **Access keys**, click **Create access key.**
6. In **Access key best practices & alternatives** page, select **Command Line Interface (CLI).**
7. Acknowledge the recommendations, and click **Next.**
8. Click **Create access key.**
9. Copy `Access key` and `Secret access key`. This is the only time that these keys can be viewed or downloaded, and you
   will need them while executing the deployment script.
10. Click **Done.**

### 3. Execute the deployment script

The deployment script will create a Sample Solution App in the AWS cloud. To execute the deployment script, follow the
steps below,

1. Identify the deployment script for the programming language you want for your Sample Solution App,
    * For the Java application the file is [app/scripts/java/java-app.sh](app/scripts/java/java-app.sh)
2. Execute the script from your terminal,
    * To execute the Java deployment script in a Unix-based system, run `bash java-app.sh`.
3. Wait for the CloudFormation stack creation to finish,
    * Navigate to [CloudFormation console](https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks?filteringText=&filteringStatus=active&viewNested=true).
    * Wait for the stack named sp-api-app-random_suffix to show status `CREATE_COMPLETE`.

### 4. Test the sample solution

The deployment script creates a Sample Solution App in the AWS cloud. The solution consists of
a [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional workflow. To test the
sample solution, follow the steps below,

1. Open the [AWS console](https://console.aws.amazon.com/).
2. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home).
3. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix.***
4. Click **Start execution** providing **JSON Input.**

**Key Considerations -**

This sample solution works for **Single Box with Single Item and Box Packing Info known upfront.** Update the code to
handle multiple boxes and items but the API Operations flow remains the same.

Considered below attributes as [constants](lambda/utils/Constants.java) in the workflow. These are handled within the
code and hence need not provide them in JSON input.

```
QUANTITY = 1;                                         // Single Box and Single Item.
CONTENT_INFORMATION_SOURCE = "BOX_CONTENT_PROVIDED"; // Box contents have been provided by the seller.
```

The JSON input **MUST** follow the below structure. Replace them with actual values.

Valid **regionCode** values are NA, EU, FE.
Valid [Marketplaces](https://developer-docs.amazon.com/sp-api/docs/marketplace-ids) and
Valid [PageTypes](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v0-reference#pagetype). Modify
accordingly.

```
{
  "apiCredentials": {
    "refreshToken": "Atzr|Abc123def456xyz789",
    "regionCode": "NA"
    },
    "createInboundPlanRequest": {
    "destinationMarketplace": "ATVPDKIKX0DER", 
    "msku": "XX-XXXX-XXXX",
    "labelOwner": "AMAZON" or "SELLER" or "NONE",
    "prepOwner": "AMAZON" or "SELLER" or "NONE",
    "sourceAddress": {
      "addressLine1": "123 example street",
      "addressLine2": "Apt 1",
      "city": "Seattle",
      "countryCode": "US",
      "name": "Test",
      "phoneNumber": "1234567890",
      "postalCode": "12345",
      "companyName": "Test",
      "email": "test@test.com",
      "stateOrProvinceCode": "WA"
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
    },
    "templateName": "TestTemplate"
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

5. The state machine execution will **Start.** Now, **Confirm SNS Subscriptions** following below steps,
    * Login to **your specified email** inbox, lookup for email with subject **AWS Notification - Subscription Confirmation.**
    * Click **Confirm Subscription** for **ShipmentCreationFailedSNSTopic** and **LabelGeneratedSNSTopic** to receive the failed messages and box labels.
6. You can check the status of step function and navigate into the individual steps using the **Graph view** and **Step
   Detail** panels.

### 5. Clean-up

The deployment script creates a number of resources in the AWS cloud which you might want to delete after testing the
solution. To clean up these resources, follow the steps below,

1. Identify the clean-up script for the programming language of the Sample Solution App deployed to the AWS cloud,
    * For the Java application the file is [app/scripts/java/java-app-clean.sh](app/scripts/java/java-app-clean.sh).
2. Execute the script from your terminal,
    * To execute the Java clean-up script in a Unix-based system or using Git Bash, run `bash java-app-clean.sh`. Wait
      for the script to complete.

### 6. Troubleshooting

If the state machine execution fails, follow the steps below to identify the root-cause and retry the workflow,

1. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home).
2. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix.***
3. Under **Executions**, you can use the **Status** column to identify failed executions.
4. To troubleshoot errors, select the corresponding workflow execution and use the **Graph view** and **Step Detail**
   panels. Look into the **Lambda Log Group** to look into detailed errors messages.
5. After fixing the issues that caused the error, retry the workflow by clicking on **New execution**. The original
   input parameters will be automatically populated.
6. Click **Start execution**, and validate the results.