# SP-API 通知功能示例解决方案

本项目提供了一个示例解决方案，通过AWS服务和Java将[亚马逊SP-API通知功能](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference)与事件驱动的多云管道相集成。

该方案为亚马逊卖家提供了可扩展、安全且可延伸的基于订阅的处理能力，适用于内部工作流、Webhook目标以及跨平台目的地（如GCP Pub/Sub和Azure服务总线）。

其他语言README请参阅：
- [日本語ガイド](README_JP.md) - 日文开发者指南
- [README.md](README.md) – 开发者指南

---

## 解决方案功能

本解决方案帮助您探索如何将SP-API通知集成到自己的系统中——无论您是刚刚起步，还是正在构建高级多云工作流。

分步使用案例和实现示例请参阅[USAGE_GUIDE_CN.md](docs/USAGE_GUIDE_CN.md)。

## 主要特性

- 通过Lambda订阅和取消订阅SP-API通知
- 将事件转发至：
  - AWS SQS/EventBridge
  - GCP Pub/Sub
  - Azure存储队列/Azure服务总线
  - HTTP Webhooks（支持可选认证头）
- 使用Step Functions进行内部事件处理
- 在AWS Secrets Manager中安全存储凭证
- 通过CDK和Bash脚本实现全自动部署

---

## 项目结构

src/SPAPINotificationsSampleSolution/
│
├── app/ # 运行时配置和部署逻辑
│ ├── config/ # 应用配置文件及示例
│ │ ├── app-config.json
│ │ ├── notification-type-definition.json
│ │ └── example/ # 所有处理变体的app-config.json示例
│ ├── scripts/ # 基于Bash的部署逻辑
│ │ ├── java/
│ │ ├── shared/
│ │ └── iam-policy.json
│ ├── sp-api-app-cdk/ # AWS CDK基础设施(TypeScript)
│ │ ├── lib/
│ │ ├── bin/
│ │ ├── package.json
│ │ └── tsconfig.json
│ ├── step-functions/ # StepFunction定义JSON文件
│ │ └── order-change-step-functions-workflow-definition.json
│ └── tools/ # GCP和Azure的密钥设置脚本
│ ├── aws/ # 创建AWS资源的辅助工具
│ ├── gcp/ # 生成GCP密钥到SecretsManager的工具
│ └── azure/ # 生成AZURE密钥到SecretsManager的工具
│
├── code/java/ # Java Lambda源代码
│ ├── pom.xml # Maven配置
│ └── src/main/java/lambda/
│ ├── common/ # 共享常量、模型和凭证
│ ├── subscription/ # 订阅/取消订阅Lambda处理器
│ ├── process/ # 通知处理器(内部/webhook/跨平台)
│ └── utils/ # SecretsManager和StepFunctions辅助工具
│
├── docs/ # 文档
│ ├── DEPLOYMENT.md # 主要部署指南(英文)
│ ├── DEPLOYMENT_JP.md # 日语版部署指南
│ └── secret-example.csv # 凭证CSV示例



---

## 快速开始

- [DEPLOYMENT_CN.md](docs/DEPLOYMENT_CN.md) - 中文部署指南

1. **安装必备工具**：AWS CLI、Node.js(14+)、Maven、GitBash(Windows)、jq
2. **注册SP-API应用**：[注册您的应用](https://developer-docs.amazon.com/sp-api/docs/registering-your-application)
3. **配置**：编辑`app/config/app-config.json`并准备`client_secrets.csv`
4. **部署**：
   ```bash
   cd app/scripts/java
   bash java-app.sh
```

## 订阅：部署完成后，从AWS控制台或CLI触发SPAPISubscribeNotificationsLambdaFunction-<后缀>

--- 

## 核心概念

| Component            | Description                                                         |
|----------------------|---------------------------------------------------------------------|
| **Secrets Manager**  | Stores SP-API refresh tokens and seller IDs                         |
| **Lambda (Java)**    | Handles subscription, processing, forwarding, DLQ handling          |
| **SQS/EventBridge**  | Receives and routes notifications internally or to external systems |
| **Step Functions**   | Orchestrates internal workflows                                     |
| **Dynamo DB**        | DynamoDB to store subscription and credentials information           |
| **CDK (TypeScript)** | Provisions all AWS infrastructure based on `app-config.json` input  |


--- 

## 示例输入(订阅Lambda)
```json
{
  "NotificationTypes": ["ORDER_CHANGE", "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"],
  "SellerIds": ["SELLERID123", "SELLERID456"]
}
```

调用：SPAPISubscribeNotificationsLambdaFunction-<后缀>

--- 

## 文档

- [DEPLOYMENT_CN.md](docs/DEPLOYMENT_CN.md)  - 设置与部署指南

- [secret-example.csv](docs/secret-example.csv) - 卖家凭证格式示例

- [notification-type-definition.json](app/config/notification-type-definition.json) - 所有可用通知类型

---

## 清理
删除所有已配置的AWS资源：

```bash
bash java-app-clean.sh
```

这将删除Lambda函数、SQS队列、密钥、Step Functions和CDK堆栈。

--- 

## 开发者说明
- 使用Java 17和Maven编写

- Lambda处理器位于lambda.subscription、lambda.process、lambda.utils下

- 兼容多卖家注册和重试/DLQ处理

- 如果超过AWS SecretsManager大小限制，密钥会被分块存储
--- 