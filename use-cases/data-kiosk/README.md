## Overview
The Sample Solution App provides all required resources to deploy to the AWS cloud a fully functional SP-API application that implements the [Data Kiosk use case](https://developer-docs.amazon.com/sp-api/v0/docs/data-kiosk-api-v2023-11-15-use-case-guide) end-to-end.
Use this application to test the proposed solution, do changes and/or integrate it to your own product.

## Data Kiosk API
The Selling Partner API for Data Kiosk helps you programmatically submit GraphQL queries from a variety of schemas to help selling partners manage their businesses.

If you haven't already, we recommend you to navigate the following resources:
* [Data Kiosk API v2023-11-15 reference](https://developer-docs.amazon.com/sp-api/v0/docs/data-kiosk-api-v2023-11-15-reference)
* [Data Kiosk Use Case Guide](https://developer-docs.amazon.com/sp-api/v0/docs/data-kiosk-api-v2023-11-15-use-case-guide)

## Solution

This Sample Solution offers a streamlined Data Kiosk experience. Simply create your query and the solution automatically processes incoming [DATA_KIOSK_QUERY_PROCESSING_FINISHED](https://developer-docs.amazon.com/sp-api/v0/docs/data-kiosk-notification) notifications, downloads and securely stores the processed data in an S3 bucket to be later fetched and shared with the end user.


The solution consists of the following components:
* A [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional document retrieval workflow.
* [Lambda](https://aws.amazon.com/lambda/) functions that support each of the steps of the state machine.
* An [SQS](https://aws.amazon.com/sqs/) queue to receive DATA_KIOSK_QUERY_PROCESSING_FINISHED notifications.
* An [S3](https://aws.amazon.com/s3/) bucket to store generated data kiosk reports.
* A [DynamoDB](https://aws.amazon.com/dynamodb/) table to store fetched documents for the selling partner's queried data.
* A [Secrets Manager](https://aws.amazon.com/secrets-manager/) secret to securely store SP-API app credentials.

## Workflow

To kickstart the solution, begin by executing the SPAPISubscribeNotificationsLambdaFunction, providing the lambda with the necessary input containing the notificationType - [DATA_KIOSK_QUERY_PROCESSING_FINISHED](https://developer-docs.amazon.com/sp-api/v0/docs/data-kiosk-notification) - thereby subscribing the SQS queue to the Data Kiosk Notification and obtaining the subscription_id and destination_id. 
For each query, utilize the Schema Explorer to generate a GraphQL query and paste it into the SPAPICreateQueryLambdaFunction along. Make sure to handle any quotation mark inconsistencies for query validity.
After submission, the automated workflow will begin. Waiting for the [DATA_KIOSK_QUERY_PROCESSING_FINISHED](https://developer-docs.amazon.com/sp-api/v0/docs/data-kiosk-notification) notification message to be received, this will trigger the SPAPIProcessNotificationLambdaFunction and parse the message. If no documentId is returned, the flow will return a no data message; otherwise, it will parse the relative documentId and trigger the state machine's execution. 
In the background, the SPAPIGetDocumentLambdaFunction fetches the documentId and documentUrl, passing them to the SPAPIStoreDocumentLambdaFunction for storage and processing. 
Continuing the flow, the SPAPIStoreDocumentLambdaFunction retrieves the JSONL file from the documentUrl, stores it in an S3 bucket, generates an item in DynamoDB with relevant data and S3 URI, concluding the execution. 

Post-execution, all data document ids and S3 links are stored in DynamoDB, and developers can access this content from S3 as needed, ensuring an efficient and structured workflow.

## Pre-requisites
The pre-requisites for deploying the Sample Solution App to the AWS cloud are:
* [Registering as a developer for SP-API](https://developer-docs.amazon.com/sp-api/docs/registering-as-a-developer), and [registering an SP-API application](https://developer-docs.amazon.com/sp-api/docs/registering-your-application).
* An [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) with permissions to create a new user, a policy, and attach it to the user
  * If you don't have one, you can create it following the steps  under **Usage - 2. Configure Sample Solution App's IAM user** .
* The [AWS CLI](https://aws.amazon.com/cli/)
  * If not present, it will be installed as part of the deployment script.
* [Maven](https://maven.apache.org/)
  * Just for deploying a Java-based application.
  * If not present, it will be installed as part of the deployment script.
* [GitBash](https://git-scm.com/download/win)
    * in case you use Windows in order to run the deployment script.
  

## Usage
### 1. Update config file
To allow the Sample Solution App to connect to SP-API, the config file has to be updated to match the set-up of your SP-API application.
1. Open [app.config](app/app.config) file and replace all occurrences of `<dev_value>` following the instructions below.
2. Update `ClientId` and `ClientSecret` attribute values with [Client Id and Client Secret of the SP-API application](https://developer-docs.amazon.com/sp-api/docs/viewing-your-application-information-and-credentials) respectively.
3. Update `RefreshToken` attribute value with the refresh token of the selling partner you will be using for testing. 
4. Update `RegionConfig` attribute value with the region you will be using for testing. Valid values are `NA`, `EU`, and `FE`.

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
    1. For example, for the Python application the file is [app/scripts/python/python-app.sh](app/scripts/python/python-app.sh).
2. Execute the script from your terminal or Git Bash.
    1. For example, to execute the Python deployment script in a Unix-based system or using Git Bash, run `bash python-app.sh`.
3. Wait for the CloudFormation stack creation to finish.
    1. Navigate to [CloudFormation console](https://console.aws.amazon.com/cloudformation/home).
    2. Wait for the stack named **sp-api-app-*random_suffix*** to show status `CREATE_COMPLETE`.

### 4. Test the sample solution
The deployment script creates a Sample Solution App in the AWS cloud. The solution consists of a [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional workflow.
To test the sample solution, follow the steps below.

#### A. Subscribe to the Data Kiosk Notification
1. Open the [AWS console](https://console.aws.amazon.com/).
2. Navigate to [Lambda console](https://console.aws.amazon.com/lambda/home).
3. Select the notification subscriber function, named **SPAPISubscribeNotificationsLambdaFunction-*random_suffix***.
4. Select **Test** tab.
5. Under **Event JSON**, insert the following payload. Replace `NotificationType` with the notification type you want to subscribe to.
    ```
    {
        "NotificationType": "DATA_KIOSK_QUERY_PROCESSING_FINISHED"
    }
    ```
6. Click **Test**.
7. The function will return `destination Id` and `subscription Id`.

#### B. Create the Query with the Solution
1. Open the [AWS console](https://console.aws.amazon.com/).
2. Navigate to [Lambda console](https://console.aws.amazon.com/lambda/home).
3. Select the crete query function, named **SPAPICreateQueryLambdaFunction-*random_suffix***.
4. Select **Test** tab.
5. Under **Event JSON**, insert the following payload. Replace `Query` with the minified query you created in the [Schema Explorer](https://sellercentral.amazon.com/datakiosk-schema-explorer). Make sure to escape any nested double quotes (") to ensure the query input is a valid string.
    ```
    {
        "Query": "query MyQuery{analytics_salesAndTraffic_2023_11_15{salesAndTrafficByAsin(endDate:\"2024-01-31\" marketplaceIds:[\"A2Q3Y263D00KWC\"]aggregateBy:CHILD ..."
    }
    ```
6. Click **Test**.
7. The function will return `query id`.

#### C. Check Document from Dynamo DB
1. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home).
2. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix***.
3. Under **Executions**, you will see a workflow for the notification received through SQS.
4. To check the workflow status and navigate into the individual steps, select the workflow and use the **Graph view** and **Step Detail** panels.
5. Open the [AWS console](https://console.aws.amazon.com/).
6. Navigate to [DynamoDB console](https://console.aws.amazon.com/dynamodbv2/home).
7. Under **Tables**, click on **Explore items**.
8. Select the table created by the deployment script, named **SPAPISellerItemsTable-*random_suffix***.
9. Locate the item based on the query that was returned.
10. Check the S3 URI to open the document and fetch the JSONL content.

### 5. Extra
The deployment script also creates a Lambda function that cancels an ongoing query.
To test the function, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/).
2. Navigate to [Lambda console](https://console.aws.amazon.com/lambda/home).
3. Select the notification subscriber function, named **SPAPICancelQueryLambdaFunction-*random_suffix***.
4. Select **Test** tab.
5. Under **Event JSON**, insert the following payload. Replace `QueryId` with the query_id you want to cancel.
    ```
    {
        "QueryId": "1232942023"
    }
    ```
6. Click **Test**.
7. The function will return that the query has been successfully canceled.


### 6. Clean-up
The deployment script creates a number of resources in the AWS cloud which you might want to delete after testing the solution.
To clean up these resources, follow the steps below.
1. Identify the clean-up script for the programming language of the Sample Solution App deployed to the AWS cloud.
    1. For example, for the Python application the file is [app/scripts/python/python-app-clean.sh](app/scripts/python/python-app-clean.sh).
2. Execute the script from your terminal or Git Bash.
    1. For example, to execute the Python clean-up script in a Unix-based system or using Git Bash, run `bash python-app-clean.sh`.

### 7. Troubleshooting
If the state machine execution fails, follow the steps below to identify the root-cause and retry the workflow.
1. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home).
2. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix***.
3. Under **Executions**, you can use the **Status** column to identify failed executions.
4. To troubleshoot errors, select the corresponding workflow execution and use the **Graph view** and **Step Detail** panels.
5. After fixing the issues that caused the error, retry the workflow by clicking on **New execution**. The original input parameters will be automatically populated.
6. Click **Start execution**, and validate the results.
