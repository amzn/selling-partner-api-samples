## 概要

Sample SP-API Notification Solution（通知ソリューションサンプル）は、Amazon Selling Partner API（SP-API）の通知機能を活用した、エンドツーエンドのイベント駆動型アプリケーションをデプロイするためのソリューションです。このソリューションは、認証情報の登録、EventBridge の設定、AWS CDK によるインフラ構築、アプリケーションロジックの AWS Lambda へのデプロイを自動で実施します。

このプロジェクトを使うことで、SP-API 通知処理のパイプラインを迅速に構築したり、製品要件に合わせてカスタマイズすることが可能です。

## Notifications API について

SP-API Notifications API は、出品者アカウントで発生したイベントに関する通知を受け取るためのサブスクリプションを設定する機能を提供します。たとえば、注文の変更や商品リストの更新などのイベントが対象です。

主なリソース:

* [Notifications API v1 リファレンス](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference)
* [Notifications ユースケースガイド](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide)

## ソリューションアーキテクチャ

本ソリューションは以下のコアコンポーネントで構成されます：

* CDK によりデプロイされるインフラスタック（Lambda, SQS, EventBridge, IAM ロール, DynamoDB, S3 バケット）
* 通知の登録/解除、イベント処理、外部プラットフォームへの転送を行う Lambda 関数
* ドキュメントの取得や処理を行う AWS Step Functions を用いたワークフロー
* 出品者ごとの SP-API 認証情報を管理するための Secrets Manager 登録

### ワークフロー概要

1. 出品者の認証情報を含む CSV を Secrets Manager に安全に登録
2. 必要に応じ、grantless トークンを使用して EventBridge の Destination を作成および登録
3. 内部通知ワークフロー用の Step Functions 定義ファイルを S3 にアップロード
4. CDK アプリケーション全体を設定ファイルとシークレット定義に基づいてデプロイ
5. デプロイ完了後、Lambda を呼び出して特定の通知タイプに対するサブスクリプションを登録

## 前提条件

Sample Solution App を AWS 上にデプロイするには、以下の前提条件を満たす必要があります：

* [SP-API 開発者としての登録](https://developer-docs.amazon.com/sp-api/docs/registering-as-a-developer)、および [SP-API アプリケーションの登録](https://developer-docs.amazon.com/sp-api/docs/registering-your-application)
* IAM ユーザー（新しいユーザーやポリシーの作成・アタッチ権限がある）

    * 該当ユーザーがない場合は、**Usage - 2. IAM ユーザー構成手順**に従って作成してください
* [AWS CLI](https://aws.amazon.com/cli/)（スクリプト内でインストール可能）
* [NodeJS 14.15.0 以上](https://nodejs.org/en/download/package-manager)（CDK スタック構築に必要）
* [Maven](https://maven.apache.org/)（Java アプリのビルド時に必要。スクリプト内でインストール可能）
* [GitBash](https://git-scm.com/download/win)（Windows 環境でスクリプトを実行する場合）
* [jq](https://stedolan.github.io/jq/)（JSON 解析用ツール）

### I. IAM ポリシーの作成

デプロイスクリプトの実行に必要な適切な権限を持つ IAM ポリシーを作成する手順：

1. [AWS コンソール](https://console.aws.amazon.com/)を開く
2. [IAM ポリシーコンソール](https://us-east-1.console.aws.amazon.com/iamv2/home#/policies)へ移動
3. **ポリシーの作成**をクリック
4. **ポリシーエディタ**で **JSON** を選択し、以下のポリシーを貼り付ける（`{Your-AWS-accountId}` を自分のアカウント ID に置換）

#### IAM policy:
```json
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

5. **次へ**をクリック
6. 任意の名前を入力し、控えておく（次の手順で使用）
7. 内容を確認後、**ポリシーの作成**をクリック

### II. IAM ユーザーの作成

1. [IAM ユーザー管理画面](https://us-east-1.console.aws.amazon.com/iamv2/home#/users)を開く
2. **ユーザーを作成**をクリック
3. 任意のユーザー名を設定
4. **アクセス権限の設定**画面で **ポリシーを直接アタッチ** を選択
5. 上記で作成したポリシーを検索・選択し、**次へ**をクリック
6. 内容を確認し、**ユーザーの作成**を実行

### III. IAM ユーザー認証情報の取得

デプロイスクリプト実行時に、IAM ユーザーのアクセスキーが必要です。

1. 作成した IAM ユーザーの詳細ページを開く
2. **セキュリティ認証情報**タブへ移動
3. **アクセスキーの作成**をクリック
4. **使用目的**で「CLI」を選択し、**次へ**
5. 注意事項に同意後、**作成**を実行
6. 表示された `Access key` および `Secret access key` をコピー（このタイミングでのみ表示されるため、必ず控えてください）
7. **完了**をクリック

このアクセスキー情報は、デプロイ実行中に必要となります。

（前略）

## Usage（使用方法）

### 1. 設定の準備

デプロイを開始する前に、設定ファイルが正しく構成されていることを確認してください。

以下は `app-config.json` の構成例です：

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

各セクションの意味は以下の通りです。

#### 1.1 GrantlessOperationConfig の構成

* `ClientId`：SP-API アプリケーションのクライアント ID
* `ClientSecret`：クライアントシークレット
* `RegionCode`：対象の出品者が属するリージョン（NA：北米、EU：ヨーロッパ、FE：極東）

    * [マーケットプレイスの一覧はこちら](https://developer-docs.amazon.com/sp-api/docs/marketplace-ids)

```json
{
  "GrantlessOperationConfig": {
    "ClientId": "amzn1.application-oa2-client.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "ClientSecret": "amzn1.oa2-cs.v1.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "RegionCode": "FE"
  }
}
```

#### 1.2 `client_secrets.csv` の準備

出品者ごとの SP-API 認証情報とメタデータを含む CSV ファイルを作成し、デプロイ処理中に S3 にアップロードします。
`app-config.json` には次のようにファイル名を指定します：

```json
{
  "SecretsFileName": "secret.csv"
}
```

CSV フォーマット例：

```
SellerId,RefreshToken,MarketplaceId,Mail
A2TESTSELLER,Atzr|ExampleToken,A1PA6795UKMFR9,seller@example.com
```

* 各行は 1 人の SP-API 出品者に対応します
* `RefreshToken` はアプリに対して有効なトークンである必要があります
* このファイルはスクリプト実行時に手動でアップロードが求められます
* ファイルが S3 に存在しない場合、スクリプトはアップロードされるまで停止します

参考：[secret-example.csv](secret-example.csv)




（前略）

## Usage（使用方法）

### 1. 設定の準備

（中略）

---

#### Internal（カスタム Step Function 定義あり）

通知を受信した際にカスタムオーケストレーションを行いたい場合は、Step Functions の定義ファイル（JSON）を指定します。

* `Lambda`：通知を受信したときに起動される Lambda 関数
* `DlqLambda`：DLQ（デッドレターキュー）からの再処理を行う Lambda 関数
* `StepFunctions`：上記 Lambda から起動される Step Functions のワークフロー

    * `WorkFlow 名`：任意の一意な名前

        * `Lambdas`：定義ファイルに記載された順序と一致する Lambda 関数のパス
        * `Definitions`：Step Functions の定義ファイルパス

```json
{
  "NotificationType": "ORDER_CHANGE",
  "Internal": {
    "Lambda": "lambda.process.internal.orderchange.SQSNotificationsOrderChangeHandler",
    "DlqLambda": "lambda.process.internal.orderchange.SQSReprocessOrderChangeHandler",
    "StepFunctions": {
      "OrderNotification": {
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
（前略）

## Usage（使用方法）

### 1. 設定の準備

デプロイを開始する前に、設定ファイルが正しく構成されていることを確認してください。

以下は `app-config.json` の構成例です：

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

各セクションの意味は以下の通りです。

#### 1.1 GrantlessOperationConfig の構成

* `ClientId`：SP-API アプリケーションのクライアント ID
* `ClientSecret`：クライアントシークレット
* `RegionCode`：対象の出品者が属するリージョン（NA：北米、EU：ヨーロッパ、FE：極東）

    * [マーケットプレイスの一覧はこちら](https://developer-docs.amazon.com/sp-api/docs/marketplace-ids)

```json
{
  "GrantlessOperationConfig": {
    "ClientId": "amzn1.application-oa2-client.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "ClientSecret": "amzn1.oa2-cs.v1.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "RegionCode": "FE"
  }
}
```

#### 1.2 `client_secrets.csv` の準備

出品者ごとの SP-API 認証情報とメタデータを含む CSV ファイルを作成し、デプロイ処理中に S3 にアップロードします。
`app-config.json` には次のようにファイル名を指定します：

```json
{
  "SecretsFileName": "secret.csv"
}
```

CSV フォーマット例：

```
SellerId,RefreshToken,MarketplaceId,Mail
A2TESTSELLER,Atzr|ExampleToken,A1PA6795UKMFR9,seller@example.com
```

* 各行は 1 人の SP-API 出品者に対応します
* `RefreshToken` はアプリに対して有効なトークンである必要があります
* このファイルはスクリプト実行時に手動でアップロードが求められます
* ファイルが S3 に存在しない場合、スクリプトはアップロードされるまで停止します

参考：[secret-example.csv](secret-example.csv)

#### 1.3 デプロイメントパターンの選択

SP-API 通知をどのように処理するかを決定します。これにより、生成される AWS リソースや Lambda ハンドラーが変わります。

サポートされている主要なデプロイメントパターンは以下の 3 つです：

| パターン          | 説明                                                                         | `app-config.json` キーの例                                                                                                                    |
| ------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Internal      | 内部の StepFunctions および Lambda によって通知を処理します（デフォルト）                           | `"Internal"` - デフォルトでは `Internal: {}` を省略可能。高度なケースでは、独自の Lambda や StepFunctions 定義、DLQ ハンドラーを指定可能。                                        |
| CrossPlatform | 通知を外部システム（SQS、EventBridge、GCP Pub/Sub、Azure Queue、Azure Service Bus）に転送します | `"CrossPlatform"` - `DestinationType` と適切なターゲット（例：`TargetEventBusArn`, `TargetQueueUrl`, `TargetTopicId`）を指定。Lambda や DLQ ハンドラーもカスタマイズ可能。 |
| Webhook       | 通知を HTTP エンドポイントに Webhook Lambda を介して転送します                                 | `"WebHook"` - `TargetURL` の指定が必要。任意で認証ヘッダー（例：ベーシック認証、トークンベース）を `Auth` フィールドで指定可能。                                                         |

以下のセクションでは、それぞれのパターンに対応する構成例と JSON 記述例を詳しく紹介します。


---

#### Internal（デフォルトパターン）

特別な設定を行わずに、AWS 内部で Step Functions と Lambda により通知を処理するパターンです。
このパターンでは通知イベントをログ出力するだけなので、イベント構造の学習にも適しています。

```json
{
  "NotificationType": "ORDER_CHANGE"
}
```

参考：[internal-app-config.json](../app/config/example/internal-app-config.json)

---

#### CrossPlatform（AWS SQS）

通知イベントを他の AWS アカウントまたはリージョンの SQS に転送します。

* `DestinationType`：`AWS_SQS`
* `TargetSqsUrl`：通知を送信する対象 SQS キューの URL
* `TargetSqsArn`：上記 SQS の ARN
* `Lambda`：通知受信時に呼び出される Lambda 関数（省略可能）
* `DlqLambda`：失敗したイベントの再処理用 DLQ Lambda

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

最小構成（Lambda なし）：

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
参考: [cross-platform-aws-sqs-app-config.json](../app/config/example/cross-platform-aws-sqs-app-config.json)

---

#### CrossPlatform（AWS EventBridge）

通知イベントを他の AWS アカウントまたはリージョンの EventBridge バスに転送します。

* `DestinationType`：`AWS_EVENTBRIDGE`
* `TargetEventBusArn`：通知を送信する EventBridge バスの ARN
* `Lambda`、`DlqLambda`：任意（処理追加用）

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

最小構成：

```json
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

#### CrossPlatform（GCP Pub/Sub）

Google Cloud Pub/Sub トピックに通知を送信します。

* `DestinationType`：`GCP_PUBSUB`
* `GcpProjectId`：GCP プロジェクト ID
* `GcpTopicId`：Pub/Sub トピック ID
* `GcpPubsubKeyArn`：Secrets Manager に格納した GCP 認証キーの ARN
* `Lambda`、`DlqLambda`：任意

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

最小構成：
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
参考: [cross-platform-gcp-pubsub-app-config.json](../app/config/example/cross-platform-gcp-pubsub-app-config.json)

---

#### CrossPlatform（Azure Storage Queue）

Azure Storage Queue に通知を送信します。

* `DestinationType`：`AZURE_STORAGE_QUEUE`
* `AzureQueueConnectionStringArn`：接続文字列を格納した Secrets ARN
* `AzureQueueName`：Azure ストレージキュー名
* `Lambda`、`DlqLambda`：任意

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
最小構成：

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
参考: [cross-platform-azure-storage-queue-app-config.json](../app/config/example/cross-platform-azure-storage-queue-app-config.json)

---

#### CrossPlatform（Azure Service Bus）

Azure Service Bus Queue に通知を送信します。

* `DestinationType`：`AZURE_SERVICE_BUS`
* `AzureSbConnectionStringArn`：Service Bus 接続文字列の Secrets ARN
* `AzureSbQueueName`：Azure Service Bus キュー名
* `Lambda`、`DlqLambda`：任意

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
最小構成：

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
参考: [cross-platform-azure-service-bus-app-config.json](../app/config/example/cross-platform-azure-service-bus-app-config.json)

---

#### Webhook（カスタムロジックあり）

* `Url`：通知を送信する HTTP エンドポイント
* `Auth`：トークン認証用のヘッダー名・値
* `Lambda`、`DlqLambda`：Webhook 経由で通知処理する Lambda（任意）

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

---

#### Webhook（デフォルト構成）

認証情報のみ指定するシンプルな Webhook 通知設定です。

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


---

`app-config.json` と `client_secrets.csv` が準備できたら、次のステップとしてデプロイスクリプトの実行に進みます。



---

### 2. デプロイの実行

本ソリューションをデプロイするには、対象言語のスクリプトディレクトリ（例：Java の場合 `app/script/java`）に移動し、以下のコマンドを実行します：

```bash
bash java-app.sh
```

このスクリプトは以下の処理を行います：

* 前提条件と入力設定ファイルの検証
* リソース名にランダムなサフィックス（接尾辞）を付けて名前空間の重複を防止（並列デプロイの安全性確保）
* IAM ポリシーの存在確認（なければ自動作成してアタッチ）
* CDK 環境のブートストラップ処理
* SP-API クライアントシークレットを格納するセキュアな S3 バケットの作成を促す（※ `client_secrets.csv` の事前アップロードが必須）

    * バケット内に CSV が存在しない場合、スクリプトは意図的に停止します。
    * アップロード後、再度スクリプトを実行してください。
* アップロードされた CSV ファイルを読み込み、出品者ごとのシークレットを Secrets Manager に登録

    * サイズ制限を超える場合は分割（チャンク）して登録
* `notification-type-definition.json` に基づき、EventBridge の使用要否を判定

    * 必要であれば EventBridge Destination を 1 アカウント内に 1 つ作成または再利用
    * 新規作成時は **AWS コンソール上での手動関連付けが必要な場合があります**
* Step Functions の定義ファイル（内部通知用）を S3 にアップロード
* Java の場合はコードをコンパイル・パッケージング
* すべてのパラメータを注入した CDK スタックのフルデプロイを実行

> ⚠️ 重要：
>
> * `client_secrets.csv` が存在しない場合、スクリプトは S3 バケット作成後に終了します。アップロード後に再実行してください。
> * EventBridge 統合が必要で関連付けが未実施の場合、スクリプトは終了します。AWS コンソールで関連付けを完了し、再実行してください。

---

### 3. 通知のサブスクリプション登録

デプロイ完了後、AWS コンソールから `SPAPISubscribeNotificationsLambdaFunction-<suffix>` Lambda を呼び出し、以下のような入力を渡します：

```json
{
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
  "SellerIds": ["SELLERIDAAAAA", "SELLERIDBBBBB"]
}
```

これにより、通知サブスクリプションが作成され、`subscriptionId` および `destinationId` が返されます。

使用可能な NotificationTypes は、[notification-type-definition.json](../app/config/notification-type-definition.json) を参照してください。

---

### 4. ワークフローの確認

[Step Functions コンソール](https://console.aws.amazon.com/states/home) にアクセスし、実行中または完了した通知ワークフローの状況を確認できます。出力結果は DynamoDB またはオプションで S3 に保存されます。

---

### 5. 通知の解除（Unsubscribe）

デプロイ後、`SPAPIUnsubscribeNotificationsLambdaFunction-<suffix>` Lambda を呼び出し、以下のような入力を渡します：

```json
{
  "DeleteAll": true,
  "DeleteDestination": true,
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
  "SellerIds": ["A3TUGXXXXXXXX"]
}
```

#### 全件削除

```json
{
  "DeleteAll": true
}
```

#### 通知タイプごとの削除（Destination も削除）

```json
{
  "DeleteDestination": true,
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"]
}
```

#### 通知タイプ＋出品者 ID ごとの削除（Destination は削除されません）

```json
{
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
  "SellerIds": ["A3TUGXXXXXXXX"]
}
```

この操作により、該当するサブスクリプションおよび Destination（削除指定時）が削除され、削除された `subscriptionId` および `destinationId` が返されます。

---

## クリーンアップ（リソース削除）

作成されたリソースやシークレットを一括削除するためのクリーンアップスクリプトが用意されています：

```bash
bash java-app-clean.sh
```

このスクリプトは、CDK スタック、IAM ポリシー、Secrets、S3 にアップロードされたファイルなどを削除します。

---

## トラブルシューティング

* **Secrets が見つからない：** `client_secrets.csv` を指定の S3 バケットにアップロード後、スクリプトを再実行してください。
* **EventBridge の関連付けエラー：** [EventBridge パートナーソース](https://console.aws.amazon.com/events/home?#/partner-sources) にアクセスし、手動で関連付けを行ってください。
* **Step Functions の実行失敗：** 入力フォーマットや実行グラフを AWS コンソールで確認してください。

---

### CDK のコンテキストパラメータ

* `RANDOM_SUFFIX`：リソース名の一意性を確保するための接尾辞
* `CHUNKED_SECRET_NAMES`：登録された出品者シークレットの ARN（カンマ区切り）
* `NOTIFICATION_TYPE_DEF_JSON`：サポートされている通知タイプの JSON データ
* `LAMBDA_CODE_S3_KEY`：アップロードされた Java JAR ファイルの S3 パス
* `EVENT_BUS_ARN`：使用する EventBridge バスの ARN
* `DESTINATION_ID`：通知登録で使用される Destination ID
* `PROGRAMMING_LANGUAGE`：使用する実行環境の言語（例：java17）

---

このソリューションを活用することで、SP-API 通知の統合を迅速に進めることができ、カスタムワークフローや通知先の拡張にも柔軟に対応可能です。


