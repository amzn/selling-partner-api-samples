# 使用指南：SP-API通知示例解决方案

本指南提供根据技能水平和系统环境使用本解决方案的实际案例。

另请参阅主README文档：

- [DEPLOYMENT_CN.md](./DEPLOYMENT_CN.md) - 设置与部署指南

本文档作为[README_CN.md](../README_CN.md)的补充，提供详细的SP-API通知集成使用场景、架构选择和开发示例。


##  解决方案功能

本方案帮助您构建和测试端到端的SP-API通知管道。根据熟悉程度和系统需求，可按以下方式开始：

###  初级使用
首先了解SP-API事件消息类型。
使用**默认内部模式**记录原始通知：

```json
{
  "NotificationTypes": [
    {
      "NotificationType": "ORDER_CHANGE"
    },
    {
      "NotificationType": "LISTINGS_ITEM_MFN_QUANTITY_CHANGE"
    }
  ]
}
```
- 部署此配置
- 查看对应Lambda的CloudWatch日志获取原始通知
-  **这是实现业务逻辑前熟悉SP-API通知结构和时效的最佳方式.**

### 中级使用

确定通知类型后，选择转发目标：


#### AWS环境:
Use **CrossPlatform → AWS SQS or AWS EventBridge**
- 适合已有SQS微服务或EventBridge路由的场景

#### GCP环境
使用 **跨平台 → GCP Pub/Sub**
- 直接转发至GCP主题，需通过SecretsManager管理凭证

[生成GCP密钥指南](../app/tools/gcp/README.md)

#### Azure环境:
使用 **跨平台 → Azure Storage Queue** or **存储队列或服务总线**
- 存储队列适合简单工作流，服务总线适合企业级消息模式

[生成Azure存储队列密钥指南](../app/tools/azure/storage-queue/README.md)

[生成Azure服务总线密钥指南](../app/tools/azure/sb-queue/README.md)

#### 混合/本地环境
Use **Webhook**
- 通过HTTP POST转发至自定义端点，可配置认证头

所有模式均支持Lambda逻辑处理（如转换、增强）和死信队列(DLQ)处理


### 高级使用
如需在AWS内完整处理通知：
- 使用Step Functions定义工作流
- 参考示例: `step-functions/order-change-step-functions-workflow-definition.json`
- 相关handler位于 `code/java/src/main/java/lambda/process/internal/orderchange`


## Lambda Handler 开发示例

Lambda函数可作为通知管道的核心逻辑单元。

基础开发步骤：

1. 实现RequestHandler<Map<String, Object>, String>接口

2. 从输入事件解析SP-API有效载荷

3. 实现处理逻辑或触发下游服务


```java
public class SQSNotificationsOrderChangeHandler implements RequestHandler<Map<String, Object>, String> {
    private static final Gson gson = new Gson();

    public String handleRequest(Map<String, Object> input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("Received event: " + gson.toJson(input));

        // Extract detail from input (EventBridge format)
        Map<String, Object> detail = (Map<String, Object>) input.get("detail");
        if (detail == null) {
            logger.log("No detail found in event");
            return "Missing detail";
        }

        // Perform custom processing (log, transform, forward, etc.)
        String orderId = (String) ((Map<String, Object>) detail.get("OrderChangeNotification")).get("AmazonOrderId");
        logger.log("Processing order ID: " + orderId);

        return "Processed orderId: " + orderId;
    }
}
```
###  可扩展功能


解析有效载荷后，您可以：

- ** 发送邮件/消息通知相关人员

- ** 执行计算如收入汇总或交付时间预估

- ** 更新亚马逊数据通过其他SP-API操作

- ** 同步内部系统如ERP/CRM

- ** 消息去重处理多卖家账号重复通知

- ** 跨店铺逻辑如统一定价或库存管理


更多处理器示例：
- `lambda.subscription` – 订阅/取消订阅逻辑
- `lambda.process.*` –  不同处理模式实现

---

#### Java Code (Step Function 触发示例)
```java
// Execute stepFunctions
StartExecutionRequest request = new StartExecutionRequest()
        .withStateMachineArn(stateMachineArn)
        .withInput(gson.toJson(inputForStepFunction))
        .withName("execution-" + UUID.randomUUID());

StartExecutionResult result = stepFunctionsClient.startExecution(request);
```


---

## Step Functions集成指南

在app-config中配置Step Functions工作流：

```json
{
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
```

### 关键点：

- `Lambdas`: 按执行顺序列出Lambda类路径
- `Definitions`: 提供步骤函数定义文件路径(ASL格式)
- 凭证通过初始Lambda注入到步骤函数输入中

### Credential Flow
Credentials (e.g., SP-API tokens, seller metadata) are passed from the initial notification handler Lambda and injected into the input of the Step Function. Therefore, downstream Lambdas in the workflow must be designed to **expect and consume these credentials** from the state input.

完整示例参考：

- `step-functions/order-change-step-functions-workflow-definition.json`
- `lambda/process/internal/orderchange/stepfunctions/`

This pattern enables modular, auditable, and extensible workflows that can scale with complexity as your use case evolves.

---

##  参考资源

- [SP-API通知文档](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference)
- [SP-API Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide)
- [Step Functions文档](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html)
- [AWS Lambda Java 文档](https://docs.aws.amazon.com/lambda/latest/dg/java-handler.html)

---

部署说明详见 [DEPLOYMENT_CN.md](./DEPLOYMENT_CN.md).