#  SP-API Notifications Sample Solution


This project provides a sample solution that integrates [Amazon SP-API Notifications](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference) with an event-driven, multi-cloud pipeline using AWS services and Java.

It enables scalable, secure, and extensible subscription-based processing for Amazon sellers across internal workflows, webhook targets, and cross-platform destinations like GCP Pub/Sub and Azure Service Bus.

See also from the README in other language:
- [日本語ガイド](README_JP.md) – 開発者ガイド
- [日本語ガイド](README_CN.md) – 開発者ガイド

---

## What You Can Do with This Solution

This solution helps you explore how to integrate SP-API Notifications into your own system—whether you're just starting out, or building advanced multi-cloud workflows.

See [USAGE_GUIDE.md](docs/USAGE_GUIDE.md) for step-by-step use cases and implementation examples.



##  Features

- Subscribe and unsubscribe to SP-API notifications via Lambda
- Forward events to:
    - AWS SQS / EventBridge
    - GCP Pub/Sub
    - Azure Storage Queue / Azure Service Bus
    - HTTP Webhooks (with optional auth headers)
- Internal event processing using Step Functions
- Secure credential storage in AWS Secrets Manager
- Fully automated deployment with CDK and Bash scripts

---

##  Project Structure

```text
src/SPAPINotificationsSampleSolution/
│
├── app/                          # Runtime configuration, deployment logic
│   ├── config/                   # App config files & examples
│   │   ├── app-config.json
│   │   ├── notification-type-definition.json
│   │   └── example/             # Example of app-config.json for all the process variation
│   ├── scripts/                 # Bash-based deployment logic
│   │   ├── java/
│   │   ├── shared/
│   │   └── iam-policy.json
│   ├── sp-api-app-cdk/          # AWS CDK infrastructure (TypeScript)
│   │   ├── lib/
│   │   ├── bin/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── step-functions/          # StepFunction definition JSONs
│   │   └── order-change-step-functions-workflow-definition.json
│   └── tools/                   # Secrets setup scripts for GCP, Azure
│       ├── aws/                 # Helper tools to create aws resources
│       ├── gcp/                 # Helper tools to generate GCP KEY SecretsManager
│       └── azure/               # Helper tools to generate AZURE KEY SecretsManager
│
├── code/java/                   # Java Lambda source code
│   ├── pom.xml                  # Maven config
│   └── src/main/java/lambda/
│       ├── common/              # Shared constants, models, credentials
│       ├── subscription/        # Subscribe/Unsubscribe Lambda handlers
│       ├── process/             # Notification processors (internal/webhook/crossplatform)
│       └── utils/               # SecretsManager, StepFunctions helpers
│
├── docs/                        # Documentation
│   ├── DEPLOYMENT.md            # Main deployment guide (EN)
│   ├── DEPLOYMENT_JP.md         # 日本語版デプロイ手順
│   └── secret-example.csv       # Sample credentials CSV
```

---

##  Quick Start

- [DEPLOYMENT.md](docs/DEPLOYMENT.md) – English deployment guide

1. **Install prerequisites**: AWS CLI, Node.js (14+), Maven, GitBash (Windows), jq
2. **Register your SP-API app**: [Register your app](https://developer-docs.amazon.com/sp-api/docs/registering-your-application)
3. **Configure**: Edit `app/config/app-config.json` and prepare `client_secrets.csv`
4. **Deploy**:
   ```bash
   cd app/scripts/java
   bash java-app.sh
   ```
5. **Subscribe**: After deployment, trigger `SPAPISubscribeNotificationsLambdaFunction-<suffix>` from AWS Console or CLI

---

##  Concepts

| Component            | Description                                                         |
|----------------------|---------------------------------------------------------------------|
| **Secrets Manager**  | Stores SP-API refresh tokens and seller IDs                         |
| **Lambda (Java)**    | Handles subscription, processing, forwarding, DLQ handling          |
| **SQS/EventBridge**  | Receives and routes notifications internally or to external systems |
| **Step Functions**   | Orchestrates internal workflows                                     |
| **Dynamo DB**        | DynamoDB to store subscription and credentials information           |
| **CDK (TypeScript)** | Provisions all AWS infrastructure based on `app-config.json` input  |

---

##  Sample Input (Subscribe Lambda)

```json
{
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
  "SellerIds": ["SELLERID123", "SELLERID456"]
}
```

Invoke: `SPAPISubscribeNotificationsLambdaFunction-<suffix>`

---

## Documentation

- [DEPLOYMENT.md](docs/DEPLOYMENT.md) – Setup & Deployment Guide
- [secret-example.csv](docs/secret-example.csv) – Example seller credential format
- [notification-type-definition.json](app/config/notification-type-definition.json) – All available notification types

---

## Clean-up

To remove all provisioned AWS resources:

```bash
bash java-app-clean.sh
```

This deletes Lambda functions, SQS queues, secrets, Step Functions, and CDK stack.

---

## Developer Notes

- Written in Java 17 with Maven
- Lambda handlers located under `lambda.subscription`, `lambda.process`, `lambda.utils`
- Compatible with multi-seller registration and retry/DLQ processing
- Secrets chunked if oversized for AWS SecretsManager

---



