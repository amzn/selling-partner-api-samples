# Overview
This Sample Solution provides all required resources to deploy to the AWS cloud a fully functional SP-API application that implements the [Fulfillment Outbound use case](https://developer-docs.amazon.com/sp-api/docs/fulfillment-outbound-api-v2020-07-01-use-case-guide) end-to-end. 
Use this application to test the proposed solution, do changes and/or integrate it to your own product.

## Fulfillment Outbound API
The Selling Partner API for Fulfillment Outbound (Fulfillment Outbound API) lets you create applications that help a seller fulfill Multi-Channel Fulfillment orders using their inventory in Amazon's fulfillment network. You can also get information on both potential and existing fulfillment orders.

If you haven't already, we recommend you to navigate the following resources:
* [Fulfillment Outbound API Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/fulfillment-outbound-api-v2020-07-01-use-case-guide)
* [Fulfillment Outbound API v2020-07-01 reference](https://developer-docs.amazon.com/sp-api/docs/fulfillment-outbound-api-v2020-07-01-reference)

## Sample Video Tutorial

[![Fulfillment Outbound Solution: Setup and Installation Tutorial](https://img.youtube.com/vi/ZUw5Ubb8Rj0/sddefault.jpg)](https://www.youtube.com/watch?v=ZUw5Ubb8Rj0)

## Solution
This Sample Solution implements three fulfillment outbound workflows that cover the create order, cancel order, and get package tracking details use cases.

The solution consists of the following components:
* Three [Step Functions](https://aws.amazon.com/step-functions/) state machines with fully functional Fulfillment Outbound workflows
* [Lambda](https://aws.amazon.com/lambda/) functions that support each of the steps of the state machines
* [SQS](https://aws.amazon.com/sqs/) queues to receive notifications to trigger the Step Functions workflow
* An [S3](https://aws.amazon.com/s3/) bucket to store generated code
* A [Secrets Manager](https://aws.amazon.com/secrets-manager/) secret to securely store SP-API app credentials

### Workflow
This sample solution consists of 3 sub-workflows:
* Create order
* Get package tracking details
* Cancel order

The [create order workflow](https://developer-docs.amazon.com/sp-api/docs/fulfillment-outbound-api-v2020-07-01-use-case-guide#tutorial-create-an-order-in-hold-status-and-then-move-it-to-shipped) reacts to user-generated notifications placed in an SQS queue. These events are processed by the **SPAPIProcessNotificationLambdaFunction**,  which starts a Step Functions state machine execution with the order creation logic.  
The state machine retrieves the fulfillment order preview details by invoking the **SPAPIPreviewOrderLambdaFunction**, where the preview output is placed in the logs. In a production environment, this output could be used to identify available shipping speeds, costs associated with a given feature set, etc., to make a decision about what create order options are available and desired. Next, the **SPAPICreateOrderLambdaFunction** creates an order in the `HOLD` state. The **SPAPIGetOrderLambdaFunction** uses the seller fulfillment order Id to retrieve the order and confirm it was created correctly. Finally, the order status is updated to `SHIP` by the **SPAPIUpdateOrderLambdaFunction** to continue its fulfillment path.

The [get package tracking details workflow](https://developer-docs.amazon.com/sp-api/docs/fulfillment-outbound-api-v2020-07-01-use-case-guide#step-7-get-the-package-number) reacts to incoming [FULFILLMENT_ORDER_STATUS](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#fulfillment_order_status) notifications that inform about shipping detail updates. These events, delivered to an SQS queue, are processed and transformed in the **SPAPIProcessTrackingDetailsNotificationLambdaFunction**, which subsequently starts a Step Functions state machine execution.  
The state machine uses the seller fulfillment order Id from the notification as input to the **SPAPIGetOrderTrackingDetailsLambdaFunction**, which gets the order information and processes the related shipments to get their package numbers. Next, the **SPAPIGetPackageTrackingDetailsLambdaFunction** iterates through the package numbers and retrieves the tracking information for each of them.

The [cancel order workflow](https://developer-docs.amazon.com/sp-api/docs/fulfillment-outbound-api-v2020-07-01-use-case-guide#tutorial-cancel-a-fulfillment-order) reacts to user-generated notifications placed in an SQS queue, and subsequently starts a Step Functions state machine that performs the single step of canceling an order.

## Pre-requisites
The pre-requisites for deploying the Sample Solution App to the AWS cloud are:
* [Registering as a developer for SP-API](https://developer-docs.amazon.com/sp-api/docs/registering-as-a-developer), and [registering an SP-API application](https://developer-docs.amazon.com/sp-api/docs/registering-your-application)
* An [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) with permissions to create a new user, a policy, and attach it to the user
  * If you don't have one, you can create it following the steps  under **Usage - 2. Configure Sample Solution App's IAM user** 
* The [AWS CLI](https://aws.amazon.com/cli/)
  * If not present, it will be installed as part of the deployment script
* [Maven](https://maven.apache.org/)
  * Just for deploying a Java-based application
  * If not present, it will be installed as part of the deployment script

## Usage
### 1. Update config file
To allow the Sample Solution App to connect to SP-API, the config file has to be updated to match the set-up of your SP-API application.
1. Open [app.config](app/app.config) file and replace all occurrences of `<dev_value>` following the instructions below:
2. Update `ClientId` and `ClientSecret` attribute values with [Client Id and Client Secret of the SP-API application](https://developer-docs.amazon.com/sp-api/docs/viewing-your-application-information-and-credentials) respectively
3. Update `RefreshToken` attribute value with the refresh token of the selling partner you will be using for testing
4. Update `RegionCode` attribute value with the region of the selling partner you will be using for testing. Valid values are `NA`, `EU`, and `FE`

>Note: While updating the config file, don't leave blank spaces before and after `=`, and don't use quotation marks

#### Sample config file:
```
ClientId=amzn1.application-oa2-client.abc123def456xyz789
ClientSecret=amzn1.oa2-cs.v1.abc123def456xyz789
RefreshToken=Atzr|Abc123def456xyz789
RegionCode=NA
```

### 2. Configure Sample Solution App's IAM user
#### I. Create IAM policy
In order to execute the deployment script, an IAM user with the appropriate permissions is needed.
To create a new IAM policy with the required permissions, follow the steps below.

1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [IAM Policies console](https://us-east-1.console.aws.amazon.com/iamv2/home#/policies)
3. Click **Create policy**
4. Next to **Policy editor**, select **JSON** and replace the default policy with the JSON below. Make sure to replace `<aws_account_id_number>` your AWS account id number
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
5. Click **Next**
6. Select a name for your policy. Take note of this value as you will need it in the next section.
7. Review the changes and click **Create policy**

#### II. Create IAM user
To create a new IAM user with the required permissions, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [IAM Users console](https://us-east-1.console.aws.amazon.com/iamv2/home#/users)
3. Click **Create user**
4. Select a name for your user
5. In the **Set permissions** page, select **Attach policies directly**
6. In the **Permissions policies**, search for the policy created in **I. Create IAM policy** section. Select the policy, and click **Next**
7. Review the changes and click **Create user**

#### III. Retrieve IAM user credentials
Security credentials for the IAM user will be requested during the deployment script execution.
To create a new access key pair, follow the steps below. If you already have valid access key and secret access key, you can skip this section.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [IAM Users console](https://us-east-1.console.aws.amazon.com/iamv2/home#/users)
3. Select the IAM user created in **II. Create IAM user**
4. Go to **Security credentials** tab
5. Under **Access keys**, click **Create access key**
6. In **Access key best practices & alternatives** page, select **Command Line Interface (CLI)**
7. Acknowledge the recommendations, and click **Next**
8. Click **Create access key**
9. Copy `Access key` and `Secret access key`. This is the only time that these keys can be viewed or downloaded, and you will need them while executing the deployment script
10. Click **Done**

### 3. Execute the deployment script
The deployment script will create a Sample Solution App in the AWS cloud.
To execute the deployment script, follow the steps below.
1. Identify the deployment script for the programming language you want for your Sample Solution App.
   1. For example, for the Java application the file is [app/scripts/java/java-app.sh](app/scripts/java/java-app.sh)
2. Execute the script from your terminal
   1. For example, to execute the Java deployment script in a Unix-based system, run `bash java-app.sh`
3. Wait for the CloudFormation stack creation to finish
   1. Navigate to [CloudFormation console](https://console.aws.amazon.com/cloudformation/home)
   2. Wait for the stack named **sp-api-app-\<language\>-*random_suffix*** to show status `CREATE_COMPLETE` 

### 4. Test the Sample Solution
#### I. Create Order Workflow
The deployment script creates a Sample Solution App in the AWS cloud.
We assume your account has valid inventory associated with it. To test it, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [SQS console](https://console.aws.amazon.com/sqs/v2/home)
3. Select the SQS queue created by the deployment script, named **sp-api-notifications-queue-*random_suffix***
4. Select **Send and receive messages**
5. Under **Message body**, insert the following simplified notification body where `createFulfillmentOrderNotification`'s object is replaced by a valid [CreateFulfillmentOrderRequest](https://developer-docs.amazon.com/sp-api/docs/fulfillment-outbound-api-v2020-07-01-reference#createfulfillmentorderrequest) object. For example, the object below with all values within `<>` replaced with appropraite values would constitute a valid notification body.

Notes: 
Do not include `<>` characters when creating the paylad. 
In order for the UpdateOrder function to succeed `fulfillmentAction` must have a value of "Hold".


    ```
    {
        "NotificationType": "ORDER_CREATION",
        "EventTime": "2023-07-01T15:30:00.000Z",
        "Payload": {
            "createFulfillmentOrderNotification": {
                "marketplaceId": "<marketplaceId>",
                "sellerFulfillmentOrderId": "<sellerFulfillmentOrderId>",
                "displayableOrderId": "<displayableOrderId>",
                "displayableOrderDate": "<displayableOrderDate>",
                "displayableOrderComment": "<displayableOrderComment>",
                "shippingSpeedCategory": "<shippingSpeedCategory>",
                "destinationAddress": {
                    "name": "<name>",
                    "addressLine1": "<addressLine1>",
                    "city": "<city>",
                    "stateOrRegion": "<stateOrRegion>",
                    "postalCode": "<postalCode>",
                    "countryCode": "<countryCode>",
                    "phone": "<phone>"
                },
                "fulfillmentAction": "Hold",
                "items": [
                    {
                        "sellerSku": "<sellerSku>",
                        "sellerFulfillmentOrderItemId": "<sellerFulfillmentOrderItemId>",
                        "quantity": <quantity>
                    }
                ]
            }
        }
    }
    ```
7. Click **Send message**
8. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home)
9. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix***
10. Under **Executions**, you will see a workflow for the order submitted through SQS
11. To check the workflow status and navigate into the individual steps, select the workflow and use the **Graph view** and **Step Detail** panels 

#### II. Cancel Order Workflow
Note: only orders in the  "Received" or "Planning" status can be canceled
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [SQS console](https://console.aws.amazon.com/sqs/v2/home)
3. Select the SQS queue created by the deployment script, named **sp-api-cancel-notifications-queue-*random_suffix***
4. Select **Send and receive messages**
9. Under **Message body**, insert the following simplified notification body. Replace `<sellerFulfillmentOrderId>` with the Id of the order that you wish to cancel.  Note: do not include `<>` characters. 
    ```
    {
        "NotificationType": "ORDER_CANCEL",
        "EventTime": "2023-07-01T15:30:00.000Z",
        "Payload": {
            "cancelFulfillmentOrderNotification": {
                "sellerFulfillmentOrderId": "<sellerFulfillmentOrderId>"
            }
        }
    }
    ```
7. Click **Send message**
8. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home)
9. Select the state machine created by the deployment script, named **SPAPICancelStateMachine-*random_suffix***
10. Under **Executions**, you will see a workflow for the order submitted through SQS
11. To check the workflow status and navigate into the individual steps, select the workflow and use the **Graph view** and **Step Detail** panels 

#### III. Package Tracking Order Workflow
Note: only orders in the "Complete" or "CompletePartialled" status have packages that can be tracked. It is recommended that to identify when an order has moved to a status where packages can be tracked, a Notification should be subscribed to. 
##### a. Subscribe to Amazon Notifications
The deployment script also creates a Lambda function that subscribes selling partners to notifications. You can integrate this function to your product to easily onboard to the notifications feature. This will then automatically send a notification to your **sp-api-tracking-details-notifications-queue-*random_suffix*** and trigger the assoated workflow 
To test the function and subscribe to notifications, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [Lambda console](https://console.aws.amazon.com/lambda/home)
3. Select the notification subscriber function, named **SPAPISubscribeNotificationsLambdaFunction-*random_suffix***
4. Select **Test** tab
5. Under **Event JSON**, insert the following payload. Replace `RefreshToken` and `RegionCode` with the corresponding values of the selling partner and notification type you want to subscribe to.
    ```
    {
        "RefreshToken": "Atzr|Iw...",
        "RegionCode": "NA|EU|FE",
        "NotificationType": "FULFILLMENT_ORDER_STATUS"
    }
    ```
6. Click **Test**
7. The function will return `destination Id` and `subscription Id`
8. Wait. Once an order is created, when it moves to the "Complete" or "CompletePartialled" status the notification will be sent
#### b. manually trigger package tracking stack
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [SQS console](https://console.aws.amazon.com/sqs/v2/home)
3. Select the SQS queue created by the deployment script, named **sp-api-tracking-details-notifications-queue-*random_suffix***
4. Select **Send and receive messages**
9. Under **Message body**, insert the following simplified notification body. Replace `<sellerFulfillmentOrderId>` with the Id of the order that you wish to track.  Note: do not include `<>` characters. 
    ```
    {
        "NotificationVersion": "1.0",
        "NotificationType": "FULFILLMENT_ORDER_STATUS",
        "PayloadVersion": "1.0",
        "EventTime": "2020-01-11T00:09:53.109Z",
        "Payload":
        {
            "FulfillmentOrderStatusNotification":
            {
                "SellerId": "SellerId",
                "EventType": "Order",
                "StatusUpdatedDateTime": "2020-01-11T00:09:53.109Z",
                "SellerFulfillmentOrderId": "<SellerFulfillmentOrderId>",
                "FulfillmentOrderStatus": "Complete"
            }
        }
    }
    ```
7. Click **Send message**
8. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home)
9. Select the state machine created by the deployment script, named **SPAPITrackingDetailsStateMachine-*random_suffix***
10. Under **Executions**, you will see a workflow for the order submitted through SQS
11. To check the workflow status and navigate into the individual steps, select the workflow and use the **Graph view** and **Step Detail** panels 

### 6. Clean-up
The deployment script creates a number of resources in the AWS cloud which you might want to delete after testing the solution.
To clean up these resources, follow the steps below.
1. Identify the clean-up script for the programming language of the Sample Solution App deployed to the AWS cloud.
   1. For example, for the Java application the file is [app/scripts/java/java-app-clean.sh](app/scripts/java/java-app-clean.sh)
2. Execute the script from your terminal
   1. For example, to execute the Java clean-up script in a Unix-based system, run `bash java-app-clean.sh`
   2. Wait for the script to finish

### 7. Troubleshooting
If the state machine execution fails, follow the steps below to identify the root-cause and retry the workflow
1. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home)
2. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix***
3. Under **Executions**, you can use the **Status** column to identify failed executions
4. To troubleshoot errors, select the corresponding workflow execution and use the **Graph view** and **Step Detail** panels
5. After fixing the issues that caused the error, retry the workflow by clicking on **New execution**. The original input parameters will be automatically populated
6. Click **Start execution**, and validate the results
