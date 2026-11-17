## 概述

Sample SP-API Notification Solution 部署了一个端到端的事件驱动应用程序,用于集成 Amazon's Selling Partner API (SP-API) 通知功能。该解决方案可以自动注册凭证、配置 EventBridge 目标、使用 AWS CDK 配置基础设施,并将应用逻辑部署到 AWS Lambda。

使用此项目可以快速设置自己的 SP-API 通知处理流程,或根据产品需求进行定制。

## Notifications API 

SP-API Notifications API 使开发者能够订阅卖家账户中的事件通知。这些事件可以包括订单变更、商品更新等。

主要资源:

* [Notifications API v1 参考文档](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference)
* [Notifications 使用案例指南](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide)

## 解决方案架构

该解决方案包含以下核心组件:

* 使用 CDK 部署的基础设施栈,包括 Lambda 函数、SQS 队列、EventBridge 集成、IAM 角色、DynamoDB 和 S3 存储桶
* 基于 Lambda 的订阅/取消订阅通知逻辑,处理事件并转发到第三方平台
* 用于文档检索和处理的状态机驱动工作流(AWS Step Functions)
* 用于管理每个卖家 SP-API 凭证的 Secrets Manager 条目 

### 工作流程

1. 从 CSV 安全加载卖家凭证并注册到 Secrets Manager
2. 如果需要,使用免授权 SP-API token 创建和注册 EventBridge 目标
3. 将 Step Functions 定义(用于内部通知工作流)上传到 S3
4. 使用输入配置和密钥定义部署完整的 CDK 应用程序
5. 部署后,可以触发 Lambda 函数订阅特定的通知类型

## 前提条件
部署 Sample Solution App 到 AWS 云需要以下前提条件:
* [注册成为 SP-API 开发者](https://developer-docs.amazon.com/sp-api/docs/registering-as-a-developer)，并[注册 SP-API 应用程序](https://developer-docs.amazon.com/sp-api/docs/registering-your-application)
* 一个具有创建新用户、策略并将其附加到用户权限的 [IAM 用户](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html)
  * 如果没有,可以按照 **使用 - 2. 配置 Sample Solution App 的 IAM 用户** 中的步骤创建
* [AWS CLI](https://aws.amazon.com/cli/)
  * 如果没有安装,将作为部署脚本的一部分安装
* [NodeJS 14.15.0 或更高版本](https://nodejs.org/en/download/package-manager)
  * Sample solution 部署需要 AWS CDK stack
  * 如果没有安装,将作为部署脚本的一部分安装
* [Maven](https://maven.apache.org/)
  * 仅用于部署基于 Java 的应用程序
  * 如果没有安装,将作为部署脚本的一部分安装  
* [GitBash](https://git-scm.com/download/win)
  * 如果使用 Windows 系统运行部署脚本需要安装
* [jq](https://stedolan.github.io/jq/)
  * 用于 JSON 解析

#### I. 创建 IAM 策略
要执行部署脚本,需要具有相应权限的 IAM 用户。
按照以下步骤创建具有所需权限的新 IAM 策略。

1. 打开 [AWS 控制台](https://console.aws.amazon.com/)
2. 导航到 [IAM Policies 控制台](https://us-east-1.console.aws.amazon.com/iamv2/home#/policies)
3. 点击 **创建策略**
4. 在 **策略编辑器** 旁边,选择 **JSON** 并使用下面的 JSON 替换默认策略。确保将 `<aws_account_id_number>` 替换为您的 AWS 账户 ID 号
5. 按需替换您的账户 ID。

#### IAM 策略:
```
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
5. 点击 **下一步**
6. 为策略选择一个名称。记下此值,因为您将在下一部分中需要它。
7. 检查更改并点击 **创建策略**

#### II. 创建 IAM 用户
按照以下步骤创建具有所需权限的新 IAM 用户。
1. 打开 [AWS 控制台](https://console.aws.amazon.com/)
2. 导航到 [IAM Users 控制台](https://us-east-1.console.aws.amazon.com/iamv2/home#/users)  
3. 点击 **创建用户**
4. 为用户选择一个名称
5. 在 **设置权限** 页面,选择 **直接附加策略**
6. 在 **权限策略** 中,搜索在 **I. 创建 IAM 策略** 部分创建的策略。选择该策略,然后点击 **下一步**
7. 检查更改并点击 **创建用户**

#### III. 获取 IAM 用户凭证
在执行部署脚本期间将需要 IAM 用户的安全凭证。
如果您已经有有效的访问密钥和秘密访问密钥,可以跳过此部分。否则,按照以下步骤创建新的访问密钥对:
1. 打开 [AWS 控制台](https://console.aws.amazon.com/)
2. 导航到 [IAM Users 控制台](https://us-east-1.console.aws.amazon.com/iamv2/home#/users)
3. 选择在 **II. 创建 IAM 用户** 中创建的 IAM 用户
4. 转到 **安全凭证** 选项卡
5. 在 **访问密钥** 下,点击 **创建访问密钥**  
6. 在 **访问密钥最佳实践 & 替代方案** 页面,选择 **命令行界面 (CLI)**
7. 确认建议,然后点击 **下一步**
8. 点击 **创建访问密钥**
9. 复制 `访问密钥` 和 `秘密访问密钥`。这是唯一可以查看或下载这些密钥的时机,执行部署脚本时将需要它们
10. 点击 **完成**

## 使用方法

### 1. 准备配置

在开始部署之前,确保正确设置配置。

这是完整 app-config.json 的示例:
```
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
我们将在下面分解每个 JSON 元素部分。

#### 1.1 配置 GrantlessOperationConfig 
ClientId: 您应用程序的 ClientId
ClientSecret: 您应用程序的 ClientSecret
RegionCode: 目标卖家所属的区域代码
例如:北美卖家为 NA,欧洲卖家为 EU,远东卖家为 FE
[参考市场代码](https://developer-docs.amazon.com/sp-api/docs/marketplace-ids)

```
"GrantlessOperationConfig": {
  "ClientId": "amzn1.application-oa2-client.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "ClientSecret": "amzn1.oa2-cs.v1.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "RegionCode": "FE"
}
```

#### 1.2 准备 `client_secrets.csv`

为每个卖家创建包含 SP-API 凭证和元数据的 CSV 文件。此文件将在部署过程中上传到 S3 存储桶。
在 app-config.json 中指定文件名,如下所示:
```
  "SecretsFileName": "secret.csv"
```

格式:
```
SellerId,RefreshToken,MarketplaceId,Mail
A2TESTSELLER,Atzr|ExampleToken,A1PA6795UKMFR9,seller@example.com
```

- 每行代表一个唯一的 SP-API 卖家
- `RefreshToken` 必须对关联的 SP-API 应用程序有效
- 此文件必须在部署脚本提示时手动上传  
- 如果未上传,部署过程将暂停直到文件出现在 S3 中

参考: [secret-example.csv](secret-example.csv)

#### 1.3 选择您的部署模式

决定如何处理您的 SP-API 通知。这将影响生成哪些 AWS 服务和 Lambda 处理程序。

支持三种主要部署模式：

| 模式          | 描述                                                                      | `app-config.json` 配置示例                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------- |----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Internal      | 使用内部 StepFunctions 和 Lambda 处理通知。这是默认模式。                 | `"Internal"` - 对于默认处理,不需要指定 `Internal: {}`。对于高级情况,可以提供自定义 Lambda 处理程序名称和 Step Function 定义用于编排,包括 DLQ 处理程序。                              |
| CrossPlatform | 将通知转发到外部系统,如 SQS、EventBridge、GCP Pub/Sub、Azure Queue 或 Azure Service Bus。 | `"CrossPlatform"` - 必须指定 `DestinationType` 和适当的目标(例如 `TargetEventBusArn`、`TargetQueueUrl`、`TargetTopicId`)。Lambda 处理程序和 DLQ 处理程序也可以自定义。              |
| Webhook       | 通过 Webhook Lambda 将通知转发到自定义 HTTP 端点。                        | `"WebHook"` - 需要 `TargetURL`,可选择在 `Auth` 字段下添加认证头(例如,基本认证或基于令牌的头)。                                                                                    |

以下是每种模式的配置示例。

---
**Internal (自定义 Step Function 定义)**

指定 Step Function 定义 JSON 以使用自定义编排。

* **Lambda**: 接收通知时调用的 Lambda 函数。它也可以触发下面的 StepFunctions。
* **DlqLambda**: 可以消费所有通知类型的 DLQ 队列的重新处理 Lambda 处理程序。它也可以触发下面的 StepFunctions。如果您在 Lambda 中有额外的逻辑,最好使用相同逻辑的 DlqLambda。
* **StepFunctions**: 可以定义多个可从上述 Lambda 触发的 StepFunctions。

  * **WorkFlow name**: 可以根据需要定义。不能指定重复的名称。
    * **Lambdas**: StepFunction 定义文件中定义的 Lambda 函数路径。顺序必须与定义文件匹配。
    * **Definitions**: StepFunction 定义文件的路径

```
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

**Internal (默认模式)**

用于完全在 AWS 内使用 Step Functions 和内部 Lambda 处理的工作流。
目前它只记录通知事件。
这最适合用来了解通知事件的结构。

```
{
  "NotificationType": "ORDER_CHANGE"
}
```

参考: [internal-app-config.json](../app/config/example/internal-app-config.json)

---
**CrossPlatform (AWS SQS)**

将通知事件转发到另一个 AWS 账户或区域的 SQS。

* **DestinationType**: `AWS_SQS`
* **TargetSqsUrl**: 您要发布到的 SQS 队列的 URL。
* **TargetSqsArn**: 同一 SQS 队列的 ARN。
* **Lambda**: 接收通知时调用的 Lambda 函数(可选,用于自定义逻辑)。
* **DlqLambda**: 从死信队列重新处理失败事件的 DLQ 处理程序。

```
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
**CrossPlatform (AWS SQS 最小配置)**

仅将通知直接发布到 SQS 队列。

```
{
  "NotificationType": "LISTINGS_ITEM_MFN_QUANTITY_CHANGE",
  "CrossPlatform": {
    "DestinationType": "AWS_SQS",
    "TargetSqsUrl": "https://sqs.us-west-2.amazonaws.com/57093XXXXXX/cross-account-sqs-queue",
    "TargetSqsArn": "arn:aws:sqs:us-west-2:57093XXXXXX:cross-account-sqs-queue"
  }
}
```

参考: [cross-platform-aws-sqs-app-config.json](../app/config/example/cross-platform-aws-sqs-app-config.json)

---
**CrossPlatform (AWS EventBridge)**

将通知事件转发到另一个 AWS 账户或区域的 EventBridge 总线。
* **DestinationType**: `AWS_EVENTBRIDGE`
* **TargetEventBusArn**: 您要发布的 EventBridge 总线的 ARN。
* **Lambda**: 接收通知时调用的 Lambda 函数(可选,用于自定义逻辑)。
* **DlqLambda**: 从死信队列重新处理失败事件的 DLQ 处理程序。

```
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

**CrossPlatform (AWS EventBridge 最小配置)**

仅将通知直接发布到 AWS EventBridge。

```
{
  "NotificationType": "ORDER_CHANGE",
  "CrossPlatform": {
    "DestinationType": "AWS_EVENTBRIDGE",
    "TargetEventBusArn": "arn:aws:events:us-west-2:570937621669:event-bus/cross-account-event-bus"
  }
}
```

参考: [cross-platform-aws-eventbridge-app-config.json](../app/config/example/cross-platform-aws-eventbridge-app-config.json)

---
**CrossPlatform (GCP Pub/Sub)**

将通知发布到 Google Cloud Pub/Sub 主题。

* **DestinationType**: `GCP_PUBSUB`
* **GcpProjectId**: GCP 项目 ID。
* **GcpTopicId**: Pub/Sub 主题 ID。
* **GcpPubsubKeyArn**: 您需要提前创建具有 GCP Key File 的 SecretsManager ARN。请参考: [generate-gcp-pubsub-secret-resource](../app/tools/gcp/README.md)
* **Lambda**: 接收通知时调用的 Lambda 函数(可选,用于自定义逻辑)。
* **DlqLambda**: 从死信队列重新处理失败事件的 DLQ 处理程序。

```
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

**CrossPlatform (GCP Pub/Sub 最小配置)**

仅将通知直接发布到 GCP Pub/Sub。

```
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

参考: [cross-platform-gcp-pubsub-app-config.json](../app/config/example/cross-platform-gcp-pubsub-app-config.json)

---
**CrossPlatform (Azure StorageQueue)**

将通知推送到 Azure Storage Queue。

* **DestinationType**: `AZURE_STORAGE_QUEUE`
* **AzureQueueConnectionStringArn**: 您需要提前创建具有 storage-queue-connection-string 的 SecretsManager ARN。请参考: [generate-azure-storage-queue-secret-resource](../app/tools/azure/storage-queue/README.md)
* **AzureQueueName**: Azure 队列名称。
* **Lambda**: 接收通知时调用的 Lambda 函数(可选,用于自定义逻辑)。
* **DlqLambda**: 从死信队列重新处理失败事件的 DLQ 处理程序。

```
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

**CrossPlatform (Azure StorageQueue 最小配置)**

仅将通知直接发布到 Azure StorageQueue。

```
{
  "NotificationType": "ORDER_CHANGE",
  "CrossPlatform": {
    "DestinationType": "AZURE_STORAGE_QUEUE",
    "AzureQueueConnectionStringArn": "arn:aws:secretsmanager:us-west-2:{Your-AWS-accountId}:secret:AZURE_QUEUE_CONNECTION_STRING-wfzvLQ",
    "AzureQueueName": "notificationqueuetomliked"
  }
}
```

参考: [cross-platform-azure-storage-queue-app-config.json](../app/config/example/cross-platform-azure-storage-queue-app-config.json)

---
**CrossPlatform (Azure ServiceBus)**

将通知发送到 Azure Service Bus 队列。

* **DestinationType**: `AZURE_SERVICE_BUS`
* **AzureSbConnectionStringArn**: 您需要提前创建具有 storage-queue-connection-string 的 SecretsManager ARN。请参考: [generate-azure-sb-queue-secret-resource](../app/tools/azure/sb-queue/README.md)
* **AzureSbQueueName**: Azure Service Bus 队列名称。
* **Lambda**: 接收通知时调用的 Lambda 函数(可选,用于自定义逻辑)。
* **DlqLambda**: 从死信队列重新处理失败事件的 DLQ 处理程序。

```
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

**CrossPlatform (Azure ServiceBus 最小配置)**

仅将通知直接发布到 Azure ServiceBus。

```
{
  "NotificationType": "ORDER_CHANGE",
  "CrossPlatform": {
    "DestinationType": "AZURE_SERVICE_BUS",
    "AzureSbConnectionStringArn": "arn:aws:secretsmanager:us-west-2:{Your-AWS-accountId}:secret:AZURE_SB_CONNECTION_STRING-S9oZve",
    "AzureSbQueueName": "notificationsbqueuetomliked"
  }
}
```

参考: [cross-platform-azure-service-bus-app-config.json](../app/config/example/cross-platform-azure-service-bus-app-config.json)

---
**Webhook (自定义逻辑)**
* **Url**: 您想要发送 POST 请求的 URL。
* **Auth**: 认证信息
  * **HeaderName**: 存储令牌的 HTTP 头名称
  * **Value**: 认证令牌
* **Lambda**: 接收通知时调用的 Lambda 函数。它也可以触发 StepFunctions。
* **DlqLambda**: 可以消费所有通知类型的 DLQ 队列的重新处理 Lambda 处理程序。如果您在 Lambda 中有额外的逻辑，那么最好使用具有相同逻辑的 DlqLambda。

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

**Webhook (默认模式)**
当您想要将通知发送到 HTTP 端点时使用。

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
参考: [web-hook-app-config.json](../app/config/example/web-hook-app-config.json)


### 2. 执行部署

要部署解决方案,请使用目标语言运行 `deploy.sh` 脚本(例如, Java 转到 `app/script/java`):

```bash
bash java-app.sh
```

此脚本将:

* 验证前提条件和输入配置
* 生成随机后缀以命名所有资源(用于安全的并行部署)
* 检查现有 IAM 策略;如果未找到,则创建并附加一个
* 使用创建的策略引导 CDK 环境
* 提示创建安全的 S3 存储桶以保存 SP-API 客户端密钥。此存储桶是必需的,并且**在继续之前必须包含 CSV 文件(`client_secrets.csv`)**
* 如果存储桶中不存在该文件,脚本会**故意退出**,以便用户手动上传 CSV
* 文件上传后重新运行脚本
* 读取上传的 CSV 文件并将所有卖家密钥注册到 AWS Secrets Manager
* 如果超出大小限制,密钥会被分块,每个块单独存储
* 根据 `notification-type-definition.json` 文件确定是否需要 EventBridge
* 如果任何配置的通知类型需要 EventBridge,它会尝试**在每个 AWS 账户中查找或创建单个目标**
* 由于每个 AWS 账户每个区域只允许一个 EventBridge 目标,因此脚本是**幂等的** - 如果存在则会重用现有目标
* 如果是新创建的,**可能需要在 AWS 控制台中手动关联**
* 将 Step Functions 定义上传到 S3 以进行内部通知处理
* 编译和打包 Java 代码(如果选择了 Java)
* 使用注入的所有环境变量和参数部署完整的 CDK 堆栈

> ⚠️ 重要提示:
>
> * 如果缺少 `client_secrets.csv`,脚本会在创建安全 S3 存储桶后停止。上传文件后,重新运行脚本。
> * 如果需要 EventBridge 集成但尚未通过 AWS 控制台关联,脚本将退出并显示说明。完成手动关联后重新运行。

### 3. 订阅通知

部署后,从 AWS 控制台调用 `SPAPISubscribeNotificationsLambdaFunction-<suffix>` Lambda,传入如下输入:
```json
{
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
  "SellerIds": ["SELLERIDAAAAA", "SELLERIDBBBBB"]
}
```

这将创建订阅并返回 `subscriptionId` 和 `destinationId`。

您可以从此文件中选择 NotificationTypes: [notification-type-definition.json](../app/config/notification-type-definition.json)

### 4. 查看工作流执行

使用 [Step Functions 控制台](https://console.aws.amazon.com/states/home) 查看和监控通知工作流。输出存储在 DynamoDB 中,也可以选择存储在 S3 中。

### 5. 取消订阅通知

部署后,从 AWS 控制台调用 `SPAPIUnsubscribeNotificationsLambdaFunction-<suffix>` Lambda,传入如下输入:

预期输入格式:
```json
{
  "DeleteAll": true,
  "DeleteDestination": true,
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
  "SellerIds": ["A3TUGXXXXXXXX"]
}
```

* 完全删除
```json
{
  "DeleteAll": true
}
```

* 按通知类型删除
```json
{
  "DeleteDestination": true,
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"]
}
```

* 按通知类型和卖家 ID 删除
  * 注意:此操作不会删除目标
```json
{
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
  "SellerIds": ["A3TUGXXXXXXXX"]
}
```

这将删除订阅和目标,并返回已删除的 `subscriptionId` 和 `destinationId`。

## 清理

提供了清理脚本以删除预置的资源和密钥。运行:

```bash
bash java-app-clean.sh
```

这将删除堆栈、IAM 策略、密钥和已上传的 S3 对象。

## 故障排除

* **未找到密钥:** 确保在重试之前将 `client_secrets.csv` 上传到指定的 S3 存储桶。
* **EventBridge 目标关联错误:** 访问 [EventBridge partner sources](https://console.aws.amazon.com/events/home?#/partner-sources) 并手动关联目标。
* **Step Functions 执行失败:** 检查输入格式并在 AWS 控制台中检查执行图。

### CDK 上下文参数

* `RANDOM_SUFFIX`: 资源名称的唯一字符串
* `CHUNKED_SECRET_NAMES`: 已注册卖家密钥的 ARN(逗号分隔)
* `NOTIFICATION_TYPE_DEF_JSON`: 支持的通知类型的原始 JSON
* `LAMBDA_CODE_S3_KEY`: 上传到 S3 的 Java JAR 路径
* `EVENT_BUS_ARN`: EventBridge 总线的 ARN
* `DESTINATION_ID`: 用于通知订阅的 ID
* `PROGRAMMING_LANGUAGE`: 运行时语言(例如 java17)

---

此解决方案有助于快速启动 SP-API 通知集成,并可以扩展以支持自定义工作流、目标或通知类型。



