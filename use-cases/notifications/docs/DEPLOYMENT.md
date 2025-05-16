## Overview

The Sample SP-API Notification Solution deploys an end-to-end event-driven application that leverages Amazon's Selling Partner API (SP-API) Notifications. This solution automatically registers credentials, configures EventBridge destinations, provisions infrastructure using AWS CDK, and deploys application logic to AWS Lambda.

Use this project to quickly set up your own SP-API notification processing pipeline or customize it to suit your product requirements.

## Notifications API

The SP-API Notifications API enables developers to subscribe to notifications about events in a seller's account. These can include order changes, listing updates, and more.

Key resources:

* [Notifications API v1 reference](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference)
* [Notifications Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide)

## Solution Architecture

This solution consists of the following core components:

* A CDK-deployed infrastructure stack, including Lambda functions, SQS queues, EventBridge integrations, IAM roles, DynamoDB and S3 buckets.
* Lambda-based logic for subscribing/unsubscribing notifications, processing events, and forwarding to third-party platforms.
* A state-machine-driven workflow (AWS Step Functions) for document retrieval and processing.
* Secrets Manager entries for managing SP-API credentials per seller.

### Workflow

1. Seller credentials are securely loaded from a CSV and registered into Secrets Manager.
2. If required, an EventBridge destination is created and registered using a grantless SP-API token.
3. A Step Functions definition (for internal notification workflows) is uploaded to S3.
4. The full CDK application is deployed using the input configuration and secret definitions.
5. Post-deployment, Lambda functions can be triggered to subscribe to specific notification types.

## Pre-requisites
The pre-requisites for deploying the Sample Solution App to the AWS cloud are:
* [Registering as a developer for SP-API](https://developer-docs.amazon.com/sp-api/docs/registering-as-a-developer), and [registering an SP-API application](https://developer-docs.amazon.com/sp-api/docs/registering-your-application)
* An [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) with permissions to create a new user, a policy, and attach it to the user
  * If you don't have one, you can create it following the steps  under **Usage - 2. Configure Sample Solution App's IAM user**
* The [AWS CLI](https://aws.amazon.com/cli/)
  * If not present, it will be installed as part of the deployment script
* [NodeJS 14.15.0 or later](https://nodejs.org/en/download/package-manager)
  * Required by AWS CDK stack for the sample solution deployment.
  * If not present, it will be installed as part of the deployment script.
* [Maven](https://maven.apache.org/)
  * Just for deploying a Java-based application
  * If not present, it will be installed as part of the deployment script
* [GitBash](https://git-scm.com/download/win)
  * in case you use Windows in order to run the deployment script.
* [jq](https://stedolan.github.io/jq/) 
  * installed for JSON parsing.

#### I. Create IAM policy
In order to execute the deployment script, an IAM user with the appropriate permissions is needed.
To create a new IAM policy with the required permissions, follow the steps below.

1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [IAM Policies console](https://us-east-1.console.aws.amazon.com/iamv2/home#/policies)
3. Click **Create policy**
4. Next to **Policy editor**, select **JSON** and replace the default policy with the JSON below. Make sure to replace `<aws_account_id_number>` your AWS account id number
5. Replace with your account id as needed.
#### IAM policy:
```Json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "SPAPISampleAppIAMPolicy",
            "Effect": "Allow",
            "Action": [
                "iam:CreateUser",
                "iam:DeleteUser",
                "iam:ListPolicies",
                "iam:CreatePolicy",
                "iam:DeletePolicy",
                "iam:AttachUserPolicy",
                "iam:DetachUserPolicy",
                "iam:CreateAccessKey",
                "iam:DeleteAccessKey",
                "iam:GetRole",
                "iam:CreateRole",
                "iam:TagRole",
                "iam:AttachRolePolicy",
                "iam:PutRolePolicy",
                "iam:DeleteRole",
                "iam:DeleteRolePolicy",
                "iam:DetachRolePolicy",
                "iam:PassRole",
                "iam:ListAttachedRolePolicies",
                "iam:GetRolePolicy",
                "sts:AssumeRole"
            ],
            "Resource": [
                "arn:aws:iam::{Your-AWS-accountId}:user/*",
                "arn:aws:iam::{Your-AWS-accountId}:policy/*",
                "arn:aws:iam::{Your-AWS-accountId}:role/*"
            ]
        },
        {
            "Sid": "SPAPISampleAppCloudFormationPolicy",
            "Effect": "Allow",
            "Action": [
                "cloudformation:*",
                "ecr:*",
                "ssm:*"
            ],
            "Resource": [
                "arn:aws:cloudformation:*:{Your-AWS-accountId}:stack/CDKToolkit/*",
                "arn:aws:ecr:*:{Your-AWS-accountId}:repository/cdk*",
                "arn:aws:ssm:*:{Your-AWS-accountId}:parameter/cdk-bootstrap/*",
                "arn:aws:cloudformation:*:{Your-AWS-accountId}:stack/sp-api-app*",
                "arn:aws:cloudformation:us-west-2:aws:transform/Serverless-2016-10-31",
                "arn:aws:cloudformation:us-west-2:{Your-AWS-accountId}:stack/cdk-bootstrap/*",
                "arn:aws:cloudformation:us-west-2:{Your-AWS-accountId}:stack/*/*"
            ]
        },
        {
            "Sid": "SPAPISampleAppCloudFormationS3Policy",
            "Effect": "Allow",
            "Action": [
                "s3:*"
            ],
            "Resource": [
                "arn:aws:s3:::cdk*",
                "arn:aws:s3:::sp-api-app-bucket*",
                "arn:aws:s3:::*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "lambda:*",
                "lambda:GetLayerVersion"
            ],
            "Resource": [
                "arn:aws:lambda:us-west-2:{Your-AWS-accountId}:function:*",
                "arn:aws:lambda:us-west-2:209497400698:layer:php-82:35",
                "arn:aws:lambda:us-west-2:753240598075:layer:Php82FpmNginxX86:13"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "lambda:ListFunctions"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "SQS:SendMessage",
                "SQS:GetQueueAttributes"
            ],
            "Resource": "arn:aws:sqs:us-west-2:{Your-AWS-accountId}:sp-api-sqs-queue*"
        },
        {
            "Effect": "Allow",
            "Action": [
              "events:CreateEventBus",
              "events:ListPartnerEventSources",
              "events:DeleteRule",
              "events:RemoveTargets",
              "events:DescribeEventBus"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:CreateSecret",
                "secretsmanager:DeleteSecret",
                "secretsmanager:DescribeSecret",
                "secretsmanager:GetSecretValue",
                "secretsmanager:UpdateSecret"
            ],
            "Resource": "*"
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

## Usage

### 1. Prepare Configuration

Before starting the deployment, make sure your configuration is correctly set up.

This is the example of entire app-config.json.
```json
{
  "GrantlessOperationConfig": {
    "ClientId": "amzn1.application-oa2-client.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "ClientSecret": "amzn1.oa2-cs.v1.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "RegionCode": "FE"
  },
  "SecretsFileName": "secret.csv",
  "NotificationTypes": [
    {
      "NotificationType": "ORDER_CHANGE",
      "WebHook": {
        "Url": "https://xkxumlylx7.execute-api.us-west-2.amazonaws.com/prod/webhook",
        "Auth": {
          "HeaderName": "x-auth-token",
          "Value": "6a615540-a0a4-d1dd-dae3-37c73fb002de"
        },
        "Lambda": "lambda.process.webhook.SQSNotificationsOrderChangeHandler",
        "DlqLambda": "lambda.process.webhook.SQSReprocessOrderChangeHandler"
      }
    },
    {
      "NotificationType": "LISTINGS_ITEM_MFN_QUANTITY_CHANGE",
      "WebHook": {
        "Url": "https://xkxumlylx7.execute-api.us-west-2.amazonaws.com/prod/webhook",
        "Auth": {
          "HeaderName": "x-auth-token",
          "Value": "6a615540-a0a4-d1dd-dae3-37c73fb002de"
        }
      }
    }
  ]
}

```

We will break down each section of Json elements in follows.
#### 1.1 Configure GrantlessOperationConfig
ClientId:　The ClientId of your application
ClientSecret: The ClientSecret of your application
RegionCode: The RegionCode of the target seller belongs to.
e.g. North America seller will be NA, Europe seller will be EU and Far East seller will be FE
[MarketPlace reference](https://developer-docs.amazon.com/sp-api/docs/marketplace-ids)


```json
"GrantlessOperationConfig": {
  "ClientId": "amzn1.application-oa2-client.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "ClientSecret": "amzn1.oa2-cs.v1.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "RegionCode": "FE"
}
```

#### 1.2 Prepare `client_secrets.csv`

Create a CSV file with SP-API credentials and metadata per seller. This file will be uploaded to an S3 bucket during the deployment process.
Specify File name in app-config.json as below
```json
  "SecretsFileName": "secret.csv"
```

Format:
```

SellerId,RefreshToken,MarketplaceId,Mail
A2TESTSELLER,Atzr|ExampleToken,A1PA6795UKMFR9,[seller@example.com](mailto:seller@example.com)

```

- Each line represents a unique SP-API seller.
- `RefreshToken` must be valid for the associated SP-API app.
- This file must be uploaded manually when prompted by the deployment script.
- If not uploaded, the deployment process will stop until the file is present in S3.

Reference : [secret-example.csv](secret-example.csv)

#### 1.3 Choose Your Deployment Pattern

Decide how your SP-API notifications should be processed. This impacts which AWS services and Lambda handlers are generated.

There are three major deployment patterns supported:

| Pattern       | Description                                                                                                          | `app-config.json` Key Example                                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Internal      | Handles notifications using internal StepFunctions and Lambdas. This is the default pattern.                         | `"Internal"` - You don't have to specify `Internal: {}` for default handling. For advanced cases, you can provide custom Lambda handler names and Step Function definitions for orchestration, including DLQ handlers. |
| CrossPlatform | Forwards notifications to external systems such as SQS, EventBridge, GCP Pub/Sub, Azure Queue, or Azure Service Bus. | `"CrossPlatform"` - You must specify `DestinationType` and appropriate target (e.g., `TargetEventBusArn`, `TargetQueueUrl`, `TargetTopicId`). Lambda handler and DLQ handler can also be customized.                   |
| Webhook       | Forwards notifications to custom HTTP endpoints via a Webhook Lambda.                                                | `"WebHook"` - Requires `TargetURL`, and optionally, you can add authentication headers under an `Auth` field (e.g., basic auth or token-based headers).                                                                |

Below are example configurations for each pattern.

---
**Internal (Custom Step Function defined)**

Specify a Step Function definition JSON to use custom orchestration.

* **Lambda**: Lambda function invoked upon receiving the notification. It can also trigger StepFunctions below.
* **DlqLambda**: Reprocess Lambda handler that can consume DLQ queue for all the notification types. It can also trigger StepFunctions below. If you have additional logic in Lambda, then best to have DlqLambda with same logic.
* **StepFunctions**: Multiple StepFunctions can be defined which can be triggered from above Lambda.

  * **WorkFlow name**: It can be defined as you wish. Duplicate name cannot be specified.

    * **Lambdas**: The Lambda Functions' paths that are defined in StepFunction Definition file. Order has to match the definition file.
    * **Definitions**: The path of StepFunction Definition file

```json
{
  "NotificationType": "ORDER_CHANGE",
  "Internal": {
    "Lambda": "lambda.process.internal.orderchange.SQSNotificationsOrderChangeHandler",
    "DlqLambda": "lambda.process.internal.orderchange.SQSReprocessOrderChangeHandler",
    "StepFunctions": {
      "OrderNotification" : {
        "Lambdas": [
          "lambda.process.internal.orderchange.stepfunctions.RetrieveOrderHandler",
          "lambda.process.internal.orderchange.stepfunctions.SendNotificationHandler"
        ],
        "Definitions": "step-functions/order-change-step-functions-workflow-definition.json"
      }
    }
  }
}
```

**Internal (Default pattern)**

Used for workflows that are fully processed within AWS using Step Functions and internal Lambdas.
As of now it only logs the notification event.
It will be best to learn how the notification event is structured to start with.

```json
{
  "NotificationType": "ORDER_CHANGE"
}
```

Reference : [internal-app-config.json](../app/config/example/internal-app-config.json)

---
**CrossPlatform (AWS SQS)**

Forwards notification events to an SQS in another AWS account or region.

* **DestinationType**: `AWS_SQS`
* **TargetSqsUrl**: SQS URL of the queue you want to publish to.
* **TargetSqsArn**: ARN of the same SQS queue.
* **Lambda**: Lambda function invoked upon receiving the notification (optional for custom logic).
* **DlqLambda**: DLQ handler that reprocesses failed events from the dead-letter queue.

```json
{
  "NotificationType": "ORDER_CHANGE",
  "CrossPlatform": {
    "DestinationType": "AWS_SQS",
    "TargetSqsUrl": "https://sqs.us-west-2.amazonaws.com/57093XXXXXX/cross-account-sqs-queue",
    "TargetSqsArn": "arn:aws:sqs:us-west-2:57093XXXXXX:cross-account-sqs-queue",
    "Lambda": "lambda.process.crossplatform.SQSNotificationsOrderChangeHandler",
    "DlqLambda": "lambda.process.crossplatform.SQSReprocessOrderChangeHandler"
  }
}
```

**CrossPlatform (AWS SQS Minimal config)**

Only publishes the notification directly to the SQS queue.

```json
{
  "NotificationType": "LISTINGS_ITEM_MFN_QUANTITY_CHANGE",
  "CrossPlatform": {
    "DestinationType": "AWS_SQS",
    "TargetSqsUrl": "https://sqs.us-west-2.amazonaws.com/57093XXXXXX/cross-account-sqs-queue",
    "TargetSqsArn": "arn:aws:sqs:us-west-2:57093XXXXXX:cross-account-sqs-queue"
  }
}
```
Reference : [cross-platform-aws-sqs-app-config.json](../app/config/example/cross-platform-aws-sqs-app-config.json)

---
**CrossPlatform (AWS EventBridge)**

Forwards notification events to an EventBridge bus in another AWS account or region.
* **DestinationType**: `AWS_EVENTBRIDGE`
* **TargetEventBusArn**: ARN of the EventBridgeBus you want to publish.
* **Lambda**: Lambda function invoked upon receiving the notification (optional for custom logic).
* **DlqLambda**: DLQ handler that reprocesses failed events from the dead-letter queue.

```json
{
  "NotificationType": "ORDER_CHANGE",
  "CrossPlatform": {
    "DestinationType": "AWS_EVENTBRIDGE",
    "TargetEventBusArn": "arn:aws:events:us-west-2:123456789012:event-bus/cross-account-event-bus",
    "Lambda": "lambda.process.crossplatform.SQSNotificationsOrderChangeHandler",
    "DlqLambda": "lambda.process.crossplatform.SQSReprocessOrderChangeHandler"
  }
}
```

**CrossPlatform (AWS EventBridge Minimal config)**

Only publishes the notification directly to the AWS EventBridge.

```json
{
  "NotificationType": "ORDER_CHANGE",
  "CrossPlatform": {
    "DestinationType": "AWS_EVENTBRIDGE",
    "TargetEventBusArn": "arn:aws:events:us-west-2:570937621669:event-bus/cross-account-event-bus"
  }
}
```
Reference : [cross-platform-aws-eventbridge-app-config.json](../app/config/example/cross-platform-aws-eventbridge-app-config.json)

---
**CrossPlatform (GCP Pub/Sub)**

Publishes notifications to a Google Cloud Pub/Sub topic.

* **DestinationType**: `GCP_PUBSUB`
* **GcpProjectId**: GCP Project ID.
* **GcpTopicId**: Pub/Sub Topic ID.
* **GcpPubsubKeyArn**: SecretsManager ARN that you need to create beforehand with GCP Key File.  Please refer : [generate-gcp-pubsub-secret-resource](../app/tools/gcp/README.md)
* **Lambda**: Lambda function invoked upon receiving the notification (optional for custom logic).
* **DlqLambda**: DLQ handler that reprocesses failed events from the dead-letter queue.

```json
{
  "NotificationType": "ORDER_CHANGE",
  "CrossPlatform": {
    "DestinationType": "GCP_PUBSUB",
    "GcpProjectId": "my-gcp-project",
    "GcpTopicId": "my-gcp-topic-id",
    "GcpPubsubKeyArn": "arn:aws:secretsmanager:us-west-2:{Your-AWS-accountId}:secret:GCP_SPAPI_PUBSUB_KEY-utHwdl",
    "Lambda": "lambda.process.crossplatform.SQSNotificationsOrderChangeHandler",
    "DlqLambda": "lambda.process.crossplatform.SQSReprocessOrderChangeHandler"
  }
}
```

**CrossPlatform (GCP Pub/Sub Minimal config)**

Only publishes the notification directly to the GCP Pub/Sub.
```json
{
  "NotificationType": "ORDER_CHANGE",
  "CrossPlatform": {
    "DestinationType": "GCP_PUBSUB",
    "GcpProjectId": "my-gcp-project",
    "GcpTopicId": "my-gcp-topic-id",
    "GcpPubsubKeyArn": "arn:aws:secretsmanager:us-west-2:{Your-AWS-accountId}:secret:GCP_SPAPI_PUBSUB_KEY-utHwdl"
  }
}
```
Reference : [cross-platform-gcp-pubsub-app-config.json](../app/config/example/cross-platform-gcp-pubsub-app-config.json)


---
**CrossPlatform (Azure StorageQueue)**

Pushes notifications to Azure Storage Queue.

* **DestinationType**: `AZURE_STORAGE_QUEUE`
* **AzureQueueConnectionStringArn**: SecretsManager ARN that you need to create beforehand with storage-queue-connection-string.  Please refer : [generate-azure-storage-queue-secret-resource](../app/tools/azure/storage-queue/README.md)
* **AzureQueueName**: Azure Queue Name.
* **Lambda**: Lambda function invoked upon receiving the notification (optional for custom logic).
* **DlqLambda**: DLQ handler that reprocesses failed events from the dead-letter queue.

```json
{
  "NotificationType": "ORDER_CHANGE",
  "CrossPlatform": {
    "DestinationType": "AZURE_STORAGE_QUEUE",
    "AzureQueueConnectionStringArn": "arn:aws:secretsmanager:us-west-2:{Your-AWS-accountId}:secret:AZURE_QUEUE_CONNECTION_STRING-wfzvLQ",
    "AzureQueueName": "notificationqueuetomliked",
    "Lambda": "lambda.process.crossplatform.SQSNotificationsOrderChangeHandler",
    "DlqLambda": "lambda.process.crossplatform.SQSReprocessOrderChangeHandler"
  }
}
```

**CrossPlatform (Azure StorageQueue Minimal config)**

Only publishes the notification directly to the Azure StorageQueue.

```json
{
  "NotificationType": "ORDER_CHANGE",
  "CrossPlatform": {
    "DestinationType": "AZURE_STORAGE_QUEUE",
    "AzureQueueConnectionStringArn": "arn:aws:secretsmanager:us-west-2:{Your-AWS-accountId}:secret:AZURE_QUEUE_CONNECTION_STRING-wfzvLQ",
    "AzureQueueName": "notificationqueuetomliked"
  }
}
```
Reference : [cross-platform-azure-storage-queue-app-config.json](../app/config/example/cross-platform-azure-storage-queue-app-config.json)

---
**CrossPlatform (Azure ServiceBus)**
Sends notifications to Azure Service Bus Queue.

* **DestinationType**: `AZURE_SERVICE_BUS`
* **AzureSbConnectionStringArn**: SecretsManager ARN that you need to create beforehand with storage-queue-connection-string.  Please refer : [generate-azure-sb-queue-secret-resource](../app/tools/azure/sb-queue/README.md)
* **AzureSbQueueName**: Azure Service Bus Queue Name.
* **Lambda**: Lambda function invoked upon receiving the notification (optional for custom logic).
* **DlqLambda**: DLQ handler that reprocesses failed events from the dead-letter queue.

```json
{
  "NotificationType": "ORDER_CHANGE",
  "CrossPlatform": {
    "DestinationType": "AZURE_SERVICE_BUS",
    "AzureSbConnectionStringArn": "arn:aws:secretsmanager:us-west-2:{Your-AWS-accountId}:secret:AZURE_SB_CONNECTION_STRING-S9oZve",
    "AzureSbQueueName": "notificationsbqueuetomliked",
    "Lambda": "lambda.process.crossplatform.SQSNotificationsOrderChangeHandler",
    "DlqLambda": "lambda.process.crossplatform.SQSReprocessOrderChangeHandler"
  }
}
```

**CrossPlatform (Azure ServiceBus Minimal config)**

Only publishes the notification directly to the Azure ServiceBus.

```json
{
  "NotificationType": "ORDER_CHANGE",
  "CrossPlatform": {
    "DestinationType": "AZURE_SERVICE_BUS",
    "AzureSbConnectionStringArn": "arn:aws:secretsmanager:us-west-2:{Your-AWS-accountId}:secret:AZURE_SB_CONNECTION_STRING-S9oZve",
    "AzureSbQueueName": "notificationsbqueuetomliked"
  }
}
```
Reference : [cross-platform-azure-service-bus-app-config.json](../app/config/example/cross-platform-azure-service-bus-app-config.json)


---
**Webhook (Custom Logic)**
* **Url**: URL that you want to post.
* **Auth**: Authentication information
  * **HeaderName**: The Http header name to store token
  * **Value**: Authentication token
* **Lambda**: Lambda function invoked upon receiving the notification. It can also trigger StepFunctions below.
* **DlqLambda**: Reprocess Lambda handler that can consume DLQ queue for all the notification types. It can also trigger StepFunctions below. If you have additional logic in Lambda, then best to have DlqLambda with same logic.



```json
{
  "NotificationType": "ORDER_CHANGE",
  "WebHook": {
    "Url": "https://your-end-points",
    "Auth": {
      "HeaderName": "x-auth-token",
      "Value": "Your-token-value"
    },
    "Lambda": "lambda.process.webhook.SQSNotificationsOrderChangeHandler",
    "DlqLambda": "lambda.process.webhook.SQSReprocessOrderChangeHandler"
  }
}
```

**Webhook (Default pattern)**
Use when you want to send notifications to an HTTP endpoint.

```json
{
  "NotificationType": "ORDER_CHANGE",
  "WebHook": {
    "Url": "https://your-end-points",
    "Auth": {
      "HeaderName": "x-auth-token",
      "Value": "Your-token-value"
    }
  }
}
```
Reference : [web-hook-app-config.json](../app/config/example/web-hook-app-config.json)

---
Once the `app-config.json` and `client_secrets.csv` are ready, proceed to the deployment step below.
Update the `app-config.json` file with your SP-API credentials, region code, and notification types. Ensure `SecretsFileName` refers to a valid CSV file.

### 2. Execute Deployment
To deploy the solution, run the `deploy.sh` script with the target language (e.g., Java Go to `app/script/java`):

```bash
bash deploy.sh
````

This script will:

* Validate pre-requisites and input configuration.
* Generate a random suffix to namespace all resource names (for safe parallel deployments).
* Check for an existing IAM policy; if not found, create and attach one.
* Bootstrap the CDK environment using the created policy.
* Prompt to create a secure S3 bucket to hold SP-API client secrets. This bucket is required and **must contain the CSV file (`client_secrets.csv`) before proceeding**.

  * If the file does not exist in the bucket, the script **intentionally exits** so the user can manually upload the CSV.
  * Re-run the script once the file has been uploaded.
* Read the uploaded CSV file and register all seller secrets into AWS Secrets Manager.

  * Secrets are chunked if size limits are exceeded, and each chunk is stored separately.
* Determine whether EventBridge is required based on the `notification-type-definition.json` file.

  * If any of the configured notification types require EventBridge, it attempts to **find or create a single destination per AWS account**.
  * Since only one EventBridge destination is allowed per AWS account per region, the script is **idempotent**—it will reuse an existing one if present.
  * If newly created, **manual association in the AWS Console may be required**.
* Upload Step Functions definitions for internal notification processing to S3.
* Compile and package Java code (if Java is selected).
* Deploy the full CDK stack with all environment variables and parameters injected.

> ⚠️ Important:
>
> * If `client_secrets.csv` is missing, the script stops after creating the secure S3 bucket. Upload the file, then re-run the script.
> * If EventBridge integration is required but not yet associated via the AWS Console, the script will exit with instructions. Complete the manual association and re-run.

### 3. Subscribe to Notifications

After deployment, invoke the `SPAPISubscribeNotificationsLambdaFunction-<suffix>` Lambda from the AWS Console, passing an input like:
```json
{
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
  "SellerIds": ["SELLERIDAAAAA", "SELLERIDBBBBB"]
}
```

This will create a subscription and return the `subscriptionId` and `destinationId`.

You can choose NotificationTypes from this file.  [notification-type-definition.json](../app/config/notification-type-definition.json)

### 4. View Workflow Executions

Use the [Step Functions console](https://console.aws.amazon.com/states/home) to view and monitor notification workflows. Outputs are stored in DynamoDB and optionally in S3.

### 5. Unsubscribe to Notifications

After deployment, invoke the `SPAPIUnsubscribeNotificationsLambdaFunction-<suffix>` Lambda from the AWS Console, passing an input like:

Expected input format:
```json

{
  "DeleteAll": true,
  "DeleteDestination": true,
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
  "SellerIds": ["A3TUGXXXXXXXX"]
}
```

* Full deletion
```json
{
  "DeleteAll": true
}
```

* Deletion by NotificationType
```json
{
  "DeleteDestination": true,
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"]
}
```

* Deletion by NotificationType & SellerId
  * Note: Destination won't be deleted with this operation
```json
{
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
  "SellerIds": ["A3TUGXXXXXXXX"]
}
```

This will delete a subscription and destination and return the deleted `subscriptionId` and `destinationId`.

## Clean-up

A clean-up script is available to remove provisioned resources and secrets. Run:

```bash
bash destroy.sh
```

This deletes the stack, IAM policies, secrets, and uploaded S3 objects.

## Troubleshooting

* **Secrets not found:** Ensure your `client_secrets.csv` is uploaded to the indicated S3 bucket before retrying.
* **EventBridge destination association error:** Visit [EventBridge partner sources](https://console.aws.amazon.com/events/home?#/partner-sources) and manually associate the destination.
* **Step Functions execution failure:** Check input formatting and inspect the execution graph in AWS Console.

### CDK Context Parameters

* `RANDOM_SUFFIX`: Unique string for resource names
* `CHUNKED_SECRET_NAMES`: Comma-separated ARNs of registered seller secrets
* `NOTIFICATION_TYPE_DEF_JSON`: Raw JSON of supported notification types
* `LAMBDA_CODE_S3_KEY`: Java JAR path uploaded to S3
* `EVENT_BUS_ARN`: ARN of the EventBridge bus
* `DESTINATION_ID`: ID used for notification subscriptions
* `PROGRAMMING_LANGUAGE`: Runtime language (e.g., java17)

---

This solution helps fast-track SP-API notification integration and can be extended to support custom workflows, destinations, or notification types.
