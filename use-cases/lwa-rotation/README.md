## Overview
This Sample Solution provides all required resources to deploy to the AWS cloud a fully functional SP-API application that implements the Login with Amazon (LWA) Credential Rotation using the [Application Management](https://developer-docs.amazon.com/sp-api/docs/application-management-api-v2023-11-30-use-case-guide) API end-to-end. Use this application to test the proposed solution, do changes and/or integrate it to your own product.

### Application Management API
The Selling Partner API for Application Management lets you programmatically rotate the LWA client secret on your registered applications.

If you haven't already, we recommend you to navigate the following resources:
* [Application Management API Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/application-management-api-v2023-11-30-use-case-guide)
* [Application Management API reference](https://developer-docs.amazon.com/sp-api/docs/application-management-api-v2023-11-30-reference)

### Solution
This Sample Solution implements a Login with Amazon (LWA) credential rotation workflow that reacts to incoming [APPLICATION_OAUTH_CLIENT_SECRET_EXPIRY](https://developer-docs.amazon.com/sp-api/docs/application-management-api-v2023-11-30-use-case-guide#step-2-register-your-sqs-queue-to-receive-expiring-credential-notifications) notification and checks if the rotation is within the set threshold and will rotate the credentials and save the newly received secrets via [APPLICATION_OAUTH_CLIENT_NEW_SECRET](https://developer-docs.amazon.com/sp-api/docs/application-management-api-v2023-11-30-use-case-guide#step-3-get-the-latest-client-secret-from-your-sqs-queue).

The solution consists of the following components:
* Two [SQS](https://aws.amazon.com/sqs/) queues to receive notifications for expiring and new Client Secret.
* [Lambda](https://aws.amazon.com/lambda/) Functions that support each workflow.
* A [Secrets Manager](https://aws.amazon.com/secrets-manager/) secret to securely store SP-API credentials.

### Workflow
The application waits for [APPLICATION_OAUTH_CLIENT_SECRET_EXPIRY](https://developer-docs.amazon.com/sp-api/docs/application-management-api-v2023-11-30-use-case-guide#step-2-register-your-sqs-queue-to-receive-expiring-credential-notifications) notification in the LWASecretExpiry queue. This event triggers and is processed by the RotateSecretsHandler Lambda function, where it processes the notification type, verifies the client-id and if the secret is expiring within the 7 day threshold it will proceed to call the Application Management API to rotate the client secret.
Next, LWANewSecret queue expects the new secrets via [APPLICATION_OAUTH_CLIENT_NEW_SECRET](https://developer-docs.amazon.com/sp-api/docs/application-management-api-v2023-11-30-use-case-guide#step-3-get-the-latest-client-secret-from-your-sqs-queue) notification. This event triggers and is processed by the UpdateSecretsHandler Lambda Function, where it processes the notification type, verifies the client-id and updates the secret stored in Secrets Manager.

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
* [GitBash](https://git-scm.com/download/win)
    * in case you use Windows in order to run the deployment script.

## Usage
### 1. Update config file
To allow the Sample Solution App to connect to SP-API, the config file has to be updated to match the set-up of your SP-API application.
1. Open [app.config](app/app.config) file and replace all occurrences of <dev_value> following the instructions below:
2. Update **RegionCode** attribute value with the region where your selling partner application is registered.
3. Update **ClientId** and **ClientSecret** attribute values with [Client Id and Client Secret of the SP-API application](https://developer-docs.amazon.com/sp-api/docs/viewing-your-application-information-and-credentials) respectively
> Note: While updating the config file, don't leave blank spaces before and after `=`, and don't use quotation marks

#### Sample config file:
>Note: Ensure the region corresponds to the region in Seller/Vendor Central your application is registered in.
```
ClientId=amzn1.application-oa2-client.XXXXXXXXXXXX
ClientSecret=*********-******************
%% Possible values NA, EU, FE
RegionCode=NA
```
>Disclaimer: The Client Secret will change when the sample code is executed and might need to be updated in the app-config if the code is re-deployed.

### 2. Configure Sample Solution App's IAM user
#### I. Create IAM policy
In order to execute the deployment script, an IAM user with the appropriate permissions is needed.
To create a new IAM policy with the required permissions, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [IAM Policies console](https://us-east-1.console.aws.amazon.com/iamv2/home#/policies)
3. Click **Create policy**
4. Next to **Policy editor**, select **JSON** and replace the default policy with the JSON below
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
				"arn:aws:iam::610134619817:user/*",
				"arn:aws:iam::610134619817:policy/*"
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
3. Select your IAM user, which has `IAMFullAccess` permissions
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
2. Execute the script from your terminal or Git Bash
   1. For example, to execute the Java deployment script in a Unix-based system or using Git Bash, run `bash java-app.sh`

### 4. Test the sample solution
The deployment script creates a Sample Solution App in the AWS cloud. The solution consists of AWS SQS queues to receive the LWA secret expiry notification and LWA new secret notification. These notifications will trigger the respective Lambda functions to rotate the LWA secrets and update the LWA secrets in the AWS Secrets Manager.
To test the sample solution, follow the steps below.

1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [AWS SQS console](https://us-east-1.console.aws.amazon.com/sqs/v3/home?region=us-east-1#/queues)
3. On another tab, sign in to your developer account on [Seller Central](https://sellercentral.amazon.com/sellingpartner/developerconsole), [Vendor Central](https://vendorcentral.amazon.com/sellingpartner/developerconsole), or Developer Central.
4. Navigate to the Developer Console page that lists all your applications.
5. Click **Notification preferences**.
6. On the **Subscription page**, find the application for which you want to receive expiring credential notifications.
7. In the Application Client Secret Expiry row, from the drop-down select **Add new destination(SQS ARN)** where you want to receive the expiring credential notification. From the AWS SQS console, select the sqs queue created by the deployment script, named **lwa-secret-expiry-queue-*random_suffix***, copy and paste the ARN into the **Destination**. Click **create**.
8. In the Application Client New Secret row, from the drop-down select **Add new destination(SQS ARN)** where you want to receive the expiring credential notification. From the AWS SQS console, select the sqs queue created by the deployment script, named **lwa-new-secret-queue-*random_suffix***, copy and paste the ARN into the **Destination**. Click **create**.
9. Click **Subscribe** for both rows. This completes the SQS subscription process.

#### 4.1 Test the Rotate Secrets Workflow
1. Navigate to [AWS SQS console](https://us-east-1.console.aws.amazon.com/sqs/v3/home?region=us-east-1#/queues)
2. From the AWS SQS console, select the sqs queue created by the deployment script, named **lwa-secret-expiry-queue-*random_suffix***
3. Click **Send and recieve messages**
4. Update the relevant parameters in the notification payload below: **clientId**, **applicationId**, **clientSecretExpiryTime**
```
{
  "notificationVersion":"1.0",
  "notificationType":"APPLICATION_OAUTH_CLIENT_SECRET_EXPIRY",
  "payloadVersion":"2023-11-30",
  "eventTime":"2024-01-10T02:15:10.045Z",
  "payload":{
    "applicationOAuthClientSecretExpiry":{
      "clientId":"amzn1.application-oa2-client.xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "clientSecretExpiryTime":"2024-03-03T22:06:39.224Z",
      "clientSecretExpiryReason":"PERIODIC_ROTATION"
    }
  },
  "notificationMetadata":{
    "applicationId":"amzn1.sp.solution.xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "subscriptionId":"a275c00d-260c-4xxxxxxxxxxxf25",
    "publishTime":"2024-01-10T02:15:14.269Z",
    "notificationId":"e7e27216-4970-477a-882c-e4xxxxxxxxxxxxxdc"
  }
}
```
5. Copy the payload above to the AWS SQS **Send message** console.
6. Click **Send message**.
7. Navigate to the [Lambda Functions console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions)
8. From the Functions console, select the lambda function created by the deployment script, named **LWARotateClientSecretRequestLambdaFunction-*random_suffix***
9. Under **Monitor**, you can **View CloudWatch Logs**.
10. Select the latest log-stream and check for **Client secret rotation successful!** message.
> Note: LWA client secret was rotated, old Client secret will expire in 7 days, new one will arrive to the **lwa-new-secret-queue-*random_suffix*** queue .

> Note: Step 4.1 will trigger the Update Secrets workflow. 
#### [Optional] 4.2 Test the Update Secrets Workflow 
1. Navigate to [AWS SQS console](https://us-east-1.console.aws.amazon.com/sqs/v3/home?region=us-east-1#/queues)
2. From the AWS SQS console, select the sqs queue created by the deployment script, named **lwa-new-secret-queue-*random_suffix***
3. Click **Send and recieve messages**
4. Update the relevant parameters in the notification payload below: **clientId**, **applicationId**, **newClientSecret**
```
{
  "notificationVersion": "1.0",
  "notificationType": "APPLICATION_OAUTH_CLIENT_NEW_SECRET",
  "payloadVersion": "2023-11-30",
  "eventTime": "2024-01-10T22:09:17.456Z",
  "payload": {
    "applicationOAuthClientNewSecret": {
      "clientId": "amzn1.application-oa2-client.6XXXXXXXXXXXXXXXXXXXXXXXXX",
      "newClientSecret": "amzn1.oa2-cs.v1.8b6XXXXXXXXXXXXXXXXXXXXXXXXX",
      "newClientSecretExpiryTime": "2024-07-08T22:09:17.198Z",
      "oldClientSecretExpiryTime": "2024-01-17T22:09:17.180Z"
    }
  },
  "notificationMetadata": {
    "applicationId": "amzn1.sp.solution.6XXXXXXXXXXXXXXXXXXXXXXXXX",
    "subscriptionId": "8594dc0e-78dc-4b05-83a4-a6XXXXXXXXXXXXXX",
    "publishTime": "2024-01-10T22:09:18.706Z",
    "notificationId": "b0805eb9-78f7-49bb-ac0e-XXXXXXXXXXX"
  }
}
```
5. Copy the payload above to the AWS SQS **Send message** console.
6. Click **Send message**.
7. Navigate to the [Secrets Manager](https://us-east-1.console.aws.amazon.com/secretsmanager/home?region=us-east-1).
8. Under **Overview**, click **Retrieve secret value**.
9. You can verify the **ClientSecret Value** to match what you entered in the notification payload.

### 5. Clean-up
The deployment script creates a number of resources in the AWS cloud which you might want to delete after testing the solution.
To clean up these resources, follow the steps below.
1. Identify the clean-up script for the programming language of the Sample Solution App deployed to the AWS cloud.
    1. For example, for the Java application the file is [app/scripts/java/java-app-clean.sh](app/scripts/java/java-app-clean.sh)
2. Execute the script from your terminal or Git Bash
    1. For example, to execute the Java clean-up script in a Unix-based system or using Git Bash, run `bash java-app-clean.sh`

### 6. Troubleshooting
If the Lambda Handler fails, follow the steps below to identify the root-cause and retry the workflow

1. Navigate to [Lambda Functions console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions)
2. Select the lambda function created by the deployment script, named **LWARotateClientSecretsRequestLambdaFunction-*random_suffix*** or **LWAUpdateSecretsRequestLambdaFunction-*random_suffix***
3. Under **Monitor**, you can **View CloudWatch Logs**.
4. To troubleshoot errors, look through the relevant logs to troubleshoot any errors.