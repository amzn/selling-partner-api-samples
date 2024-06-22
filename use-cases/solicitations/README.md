# Overview
This Sample Solution provides all required resources to deploy to the AWS cloud a fully functional SP-API application that implements the [Solicitations use case](https://developer-docs.amazon.com/sp-api/docs/solicitations-api-use-case-guide) end-to-end.
Use this application to test the proposed solution, do changes and/or integrate it to your own product.

## Solicitations API
The Selling Partner API for Solicitations (Solicitations API) helps you build applications that let sellers send consistent, high-quality solicitations to buyers. Sellers can request both a product review and seller feedback by sending a single template-based email.

If you haven't already, we recommend you to navigate the following resources:
* [Solicitations API Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/solicitations-api-use-case-guide)
* [Solicitations API v1 reference](https://developer-docs.amazon.com/sp-api/docs/solicitations-api-v1-reference)
* [Enhancing user reviews and feedback blog post](https://developer-docs.amazon.com/sp-api-blog/docs/enhancing-user-reviews-and-feedback)

## Solution
This Sample Solution implements a solicitations workflow that reacts to incoming [ORDER_CHANGE](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#order_change) notifications and tries to submit a product review and seller feedback solicitation to the buyer at the appropriate time.

The solution consists of the following components:
* A [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional Solicitations workflow
* [Lambda](https://aws.amazon.com/lambda/) functions that support each of the steps of the state machine
* An [SQS](https://aws.amazon.com/sqs/) queue to receive notifications for new or updated Amazon orders
* A [Secrets Manager](https://aws.amazon.com/secrets-manager/) secret to securely store SP-API app credentials

### Workflow
The application waits for incoming SP-API [ORDER_CHANGE](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#order_change) notifications. These events are processed by the **SPAPISolicitationScheduler** Lambda function, which creates an [EventBridge schedule](https://aws.amazon.com/eventbridge/scheduler/) for each shipped order. This schedule is triggered 5 days after the order's earliest delivery date, at which point a Step Functions state machine is started.

The state machine validates the available actions for the order by leveraging the **SPAPIGetSolicitationActions** Lambda function, which calls the [getSolicitationActionsForOrder SP-API operation](https://developer-docs.amazon.com/sp-api/docs/solicitations-api-v1-reference#getsolicitationactionsfororder). If no actions are available, it waits for one day before retrying. If the `productReviewAndSellerFeedback` action is available, it uses the **SPAPISubmitSolicitation** Lambda function to call the [createProductReviewAndSellerFeedbackSolicitation SP-API operation](https://developer-docs.amazon.com/sp-api/docs/solicitations-api-v1-reference#createproductreviewandsellerfeedbacksolicitation) to send a request to the buyer.

## Pre-requisites
The pre-requisites for deploying the Sample Solution App to the AWS cloud are:
* [Registering as a developer for SP-API](https://developer-docs.amazon.com/sp-api/docs/registering-as-a-developer), and [registering an SP-API application](https://developer-docs.amazon.com/sp-api/docs/registering-your-application)
* An [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) with permissions to create a new user, a policy, and attach it to the user
    * If you don't have one, you can create it following the steps  under **Usage - 2. Configure Sample Solution App's IAM user**
* The [AWS CLI](https://aws.amazon.com/cli/)
    * If not present, it will be installed as part of the deployment script
* The Python app requires the following packages: `boto3`, `requests`, and `setuptools`. If not present, they will be installed as part of the deployment script

## Usage
### 1. Update config file
To allow the Sample Solution App to connect to SP-API, the config file has to be updated to match the set-up of your SP-API application.
1. Open [app.config](app/app.config) file and replace all occurrences of `<dev_value>` following the instructions below:
2. Update `ClientId` and `ClientSecret` attribute values with [Client Id and Client Secret of the SP-API application](https://developer-docs.amazon.com/sp-api/docs/viewing-your-application-information-and-credentials) respectively
3. Update `RefreshToken` attribute value with the refresh token of the selling partner you will be using for testing

>Note: While updating the config file, don't leave blank spaces before and after `=`, and don't use quotation marks

#### Sample config file:
```
ClientId=amzn1.application-oa2-client.abc123def456xyz789
ClientSecret=amzn1.oa2-cs.v1.abc123def456xyz789
RefreshToken=Atzr|Abc123def456xyz789
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
   1. For example, for the Python application the file is [app/scripts/python/python-app.sh](app/scripts/python/python-app.sh)
2. Execute the script from your terminal
   1. For example, to execute the Python deployment script in a Unix-based system, run `bash python-app.sh`
3. Wait for the CloudFormation stack creation to finish
    1. Navigate to [CloudFormation console](https://console.aws.amazon.com/cloudformation/home)
    2. Wait for the stack named **sp-api-app-\<language\>-*random_suffix*** to show status `CREATE_COMPLETE`

### 4. Test the sample solution
The deployment script creates a Sample Solution App in the AWS cloud. The solution consists of a [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional workflow.
To test the sample solution, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [SQS console](https://console.aws.amazon.com/sqs/v2/home)
3. Select the SQS queue created by the deployment script, named **sp-api-notifications-queue-*random_suffix***. Make sure not to confuse the queue with the dead-letter queue named **sp-api-notifications-dead-letter-queue-*random_suffix***
4. Select **Send and receive messages**
5. Under **Message body**, insert the following simplified notification body to execute a workflow in sandbox mode. If you want to test a real order, set `Sandbox` to `No` and replace `SellerId`, `AmazonOrderId`, and all parameters under `Summary` with the correct values of the order that you will use for testing.  The solution creates a schedule set to the order's `EarliestDeliveryDate` + 5 days.
    ```
    {
        "NotificationType": "ORDER_CHANGE",
        "Payload": {
            "OrderChangeNotification": {
                "SellerId": "ABCDEF12345678",
                "AmazonOrderId": "123-1234567-1234567",
                "Summary": {
                    "MarketplaceId": "ATVPDKIKX0DER",
                    "OrderStatus": "Shipped",
                    "EarliestDeliveryDate": "2024-01-01T13:30:00.000Z",
                    "LatestDeliveryDate": "2024-12-31T13:30:00.000Z"
                }
            }
        },
        "Sandbox": "Yes"
    }
    ```
6. Click **Send message**
7. After the EventBridge schedule's execution date, navigate to [Step Functions console](https://console.aws.amazon.com/states/home)
8. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix***
9. Under **Executions**, you will see a workflow for the order submitted through SQS
10. To check the workflow status and navigate into the individual steps, select the workflow and use the **Graph view** and **Step Detail** panels 

### 5. Extra
The deployment script also creates a Lambda function that subscribes selling partners to notifications. You can integrate this function to your product to easily onboard to the notifications feature.
To test the function, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [Lambda console](https://console.aws.amazon.com/lambda/home)
3. Select the notification subscriber function, named **SPAPISubscribeNotifications-*random_suffix***
4. Select **Test** tab
5. Under **Event JSON**, insert the following payload. Replace `RefreshToken`, `RegionCode` and `NotificationType` with the corresponding values of the selling partner and notification type you want to subscribe to.
    ```
    {
        "NotificationType": "ORDER_CHANGE",
        "RegionCode": "NA|EU|FE",
        "RefreshToken": "Atzr|Iw..."
    }
    ```
6. Click **Test**
7. The function will return `destination Id` and `subscription Id`

### 6. Clean-up
The deployment script creates a number of resources in the AWS cloud which you might want to delete after testing the solution.
To clean up these resources, follow the steps below.
1. Identify the clean-up script for the programming language of the Sample Solution App deployed to the AWS cloud.
    1. For example, for the Python application the file is [app/scripts/python/python-app-clean.sh](app/scripts/python/python-app-clean.sh)
2. Execute the script from your terminal
    1. For example, to execute the Python clean-up script in a Unix-based system, run `bash python-app-clean.sh`

### 7. Troubleshooting
If the state machine execution fails, follow the steps below to identify the root-cause and retry the workflow
1. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home)
2. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix***
3. Under **Executions**, you can use the **Status** column to identify failed executions
4. To troubleshoot errors, select the corresponding workflow execution and use the **Graph view** and **Step Detail** panels
5. After fixing the issues that caused the error, retry the workflow by clicking on **New execution**. The original input parameters will be automatically populated
6. Click **Start execution**, and validate the results