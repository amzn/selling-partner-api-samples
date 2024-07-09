## Overview
This Sample Solution provides all required resources to deploy to the AWS cloud a fully functional SP-API application that implements the [Vendor Direct Fulfillment use case](https://developer-docs.amazon.com/sp-api/docs/vendor-direct-fulfillment-apis-use-case-guide) end-to-end. Use this application to test the proposed solution, do changes and/or integrate it to your own product.

## Vendor Direct Fulfillment APIs
The Vendor Direct Fulfillment (DF) APIs help vendors in the Direct Fulfillment (DF) program manage their direct fulfillment operations programmatically through web service integration. This can help vendors improve and maintain their performance at scale, and grow their business with Amazon.
Vendors can use the DF APIs to build applications to increase operational efficiency, reduce effort, reduce errors, and improve performance.

If you haven't already, we recommend you to navigate the following resources:
* [Vendor Direct Fulfillment APIs Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/vendor-direct-fulfillment-apis-use-case-guide)

## Solution
This sample solution implements a Direct Fulfillment (DF) order workflow that pulls any orders available for fulfillment, sends an order acknowledgement for the retrieved orders and then gets the shipping label for the orders, so they can be packed and shipped by the vendor.

The solution consists of the following components:
* A [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional Vendor Direct Fulfillment workflow
* [Lambda functions](https://aws.amazon.com/lambda/) that support each of the steps of the state machine
* [DynamoDB](https://aws.amazon.com/dynamodb/) tables to store Orders  and Order Items information
* An [S3](https://aws.amazon.com/s3/) bucket to store generated shipping labels
* An [SNS](https://aws.amazon.com/sns/) topic to send email notifications when new shipping labels are generated, and if shipment confirmation is not sent for the orders being processed in the state machine
* A [Secrets Manager](https://aws.amazon.com/secrets-manager/) secret to securely store SP-API app credentials

## Workflow 
The application starts by pulling the Vendor DF Orders that are in NEW status and needs to be fulfilled by using the [getOrders](https://developer-docs.amazon.com/sp-api/docs/vendor-direct-fulfillment-orders-api-v1-reference#getorders) API. If there are orders to be fulfilled, it first sends an email notification with the order numbers to fulfill, inserts the order information in Orders DynamoDB Table and Order Items information in the OrderItems DynamoDB Table. Then each of the orders are processed in parallel for the next steps:
1. Send the Order Acknowledgement by using the [submitAcknowledgement](https://developer-docs.amazon.com/sp-api/docs/vendor-direct-fulfillment-orders-api-v1-reference#submitacknowledgement) API, and update the status of the order in Orders DynamoDB table to `ACKNOWLEDGED`.
2. Check the transaction status of the Order Acknowledgment by using the [Get Transaction Status](https://developer-docs.amazon.com/sp-api/docs/vendor-direct-fulfillment-transactions-api-v1-reference#gettransactionstatus) API, based on the transaction status there below are the three choice for the workflow:
   1. If `Success`, then generate a Shipping Label for the Order by using the [Create Shipping Label](https://developer-docs.amazon.com/sp-api/docs/vendor-direct-fulfillment-shipping-api-2021-12-28-reference#createshippinglabels) API and continue the order processing and go to Step 3.
   2. If `Processing`, then wait for 5 seconds and go back to Step 2 and check the Transaction Status again.
   3. If `Failure`, then stop processing the order further, and send a notification that Order Acknowledgement failed.

## Pre-requisites
The pre-requisites for deploying the Sample Solution App to the AWS cloud are:
* [Registering as a developer for SP-API](https://developer-docs.amazon.com/sp-api/docs/sp-api-registration-overview), and [registering an SP-API application](https://developer-docs.amazon.com/sp-api/docs/registering-your-application)
* An [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) with permissions to create a new user, a policy, and attach it to the user
    * If you don't have one, you can create it following the steps  under **Usage - 2. Configure Sample Solution App's IAM user**
* The [AWS CLI](https://aws.amazon.com/cli/)
    * If not present, it will be installed as part of the deployment script
* The CSharp app requires Amazon Lambda tools .net package
    * If not present, it will be installed as part of the deployment script
* [GitBash](https://git-scm.com/download/win)
    * in case you use Windows in order to run the deployment script.

## Usage
### 1. Update config file
To allow the Sample Solution App to connect to SP-API, the config file has to be updated to match the set-up of your SP-API application.
1. Open [app.config](app/app.config) file and replace all occurrences of `<dev_value>` following the instructions below:
2. Update `ClientId` and `ClientSecret` attribute values with [Client Id and Client Secret of the SP-API application](https://developer-docs.amazon.com/sp-api/docs/viewing-your-application-information-and-credentials) respectively
3. Update RefreshToken attribute value with the refresh token of the selling partner you will be using for testing
4. Update the `Email` attribute value with the email address where you want to receive the notifications during testing
>Note: While updating the config file, don't leave blank spaces before and after `=`, and don't use quotation marks

#### Sample config file:
```
ClientId=amzn1.application-oa2-client.abc123def456xyz789
ClientSecret=amzn1.oa2-cs.v1.abc123def456xyz789
RefreshToken=Atzr|Abc123def456xyz789
Email=login@mydomain.com
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
    1. For example, for the Csharp application the file is `app/scripts/csharp/csharp-app.sh`
2. Execute the script from your terminal or Git Bash
    1. For example, to execute the Csharp deployment script in a Unix-based system or using Git Bash, run `bash csharp-app.sh`
3. Wait for the AWS CloudFormation stack creation to finish
    1. Navigate to [AWS CloudFormation Console](https://console.aws.amazon.com/cloudformation/home)
    2. Wait for the stack named sp-api-app-random_suffix to show status `CREATE_COMPLETE`

### 4. Test the sample solution
The deployment script creates a Sample Solution App in the AWS cloud. The solution consists of a [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional workflow.
To test the sample solution, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home)
3. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix***
4. Click **Start execution**
5. Provide the below JSON in the Input & then click **Start execution** again
   ```
   {
	  "regionCode": "NA",	
	  "limit":"2"
    }
   ```
   Note:
    1. The `limit` value in the above input JSON sets the limit to maximum number of NEW DF Orders you want to process in the Testing workflow.
6. The state machine execution will start. You can check the status and navigate into the individual steps using the **Graph view** and **Step Detail** panels

### 5. Clean-up
The deployment script creates a number of resources in the AWS cloud which you might want to delete after testing the solution.
To clean-up these resources, follow the steps below.
1. Identify the clean-up script for the programming language of the Sample Solution App deployed to the AWS cloud.
    1. For example, for the Csharp application the file is `app/scripts/csharp/csharp-app-clean.sh`
2. Execute the script from your terminal or Git Bash
    1. For example, to execute the Csharp clean-up script in a Unix-based system or using Git Bash, run `bash csharp-app-clean.sh`

### 6. Troubleshooting
If the state machine execution fails, follow the steps below to identify the root-cause and retry the workflow
1. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home)
2. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix***
3. Under **Executions**, you can use the **Status** column to identify failed executions
4. To troubleshoot errors, select the corresponding workflow execution and use the **Graph view** and **Step Detail** panels
5. After fixing the issues that caused the error, retry the workflow by clicking on **New execution**. The original input parameters will be automatically populated
6. Click **Start execution**, and validate the results