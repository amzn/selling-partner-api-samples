# Usage Guide: SP-API Notifications Sample Solution

If you're looking for real-world examples of how to use this solution depending on your skill level or system environment, this guide is for you.

See also from the main README:

- [DEPLOYMENT.md](./DEPLOYMENT.md) – Setup & Deployment Guide

This document complements the main [README.md](../README.md) by providing detailed usage scenarios, architecture choices, and development examples for integrating with the Amazon Selling Partner API (SP-API) Notifications.


##  What You Can Do with This Solution

This solution helps you build and test an end-to-end SP-API notification pipeline. Depending on your familiarity level and system requirements, here's how you can get started:

###  Beginner
Start by understanding what kind of SP-API event messages are sent.
Use the **default Internal pattern** to log incoming notifications without processing:

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
- Deploy with this configuration
- Check CloudWatch Logs from the corresponding Lambda to view the raw notification payload
-  **This is the best way to get familiar with the structure and timing of SP-API notifications before implementing business logic.**

### Intermediate
Once your use case or desired `NotificationTypes` are defined, determine where you want to forward the notifications.
Depending on your system architecture, choose the appropriate external destination:

#### You are using AWS:
Use **CrossPlatform → AWS SQS or AWS EventBridge**
- Best if you already use SQS-based microservices or EventBridge routing for internal processing.

#### You using GCP:
Use **CrossPlatform → GCP Pub/Sub**
- Forward notifications directly to a GCP topic. Requires credential management via SecretsManager.

[How To generate Key Secrets Manager for GCP](../app/tools/gcp/README.md)

#### You are using Azure:
Use **CrossPlatform → Azure Storage Queue** or **Azure Service Bus**
- Choose Storage Queue for simpler workflows or Service Bus for enterprise messaging patterns.

[How To generate Key Secrets Manager for Azure storage queue](../app/tools/azure/storage-queue/README.md)

[How To generate Key Secrets Manager for Azure SB queue](../app/tools/azure/sb-queue/README.md)

#### You use on-premises or hybrid systems:
Use **Webhook**
- Notifications are forwarded via HTTP POST to a custom endpoint. Auth headers (e.g. token) can be configured.

Each of these patterns supports optional Lambda logic (e.g., transformation, enrichment) and DLQ handling.

### Advanced
If you'd like to fully process SP-API notifications **within AWS** using orchestrated logic:
- Define a workflow using **Step Functions** and multiple **Lambda** components
- Sample: see `step-functions/order-change-step-functions-workflow-definition.json`
- Related handlers are in: `code/java/src/main/java/lambda/process/internal/orderchange`

## Lambda Handler Development Example

Lambda functions can serve as the main logic units in your notification pipeline. After initial payload extraction, you can implement a variety of actions depending on your business requirements.

To develop a new handler:

1. Implement `RequestHandler<Map<String, Object>, String>` or other required AWS Lambda interface.
2. Parse SP-API payload from the event input.
3. Implement processing logic or trigger downstream services (e.g., SQS, Step Functions).

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
###  Next Steps You Can Implement in Lambda

Once the payload is parsed and validated, you can:

- **Send emails or message** to notify stakeholders (e.g., order received, low inventory)
- **Perform calculations** such as revenue summaries or delivery time estimations
- **Update Amazon data** using other SP-API operations (e.g., pricing, inventory)
- **Update your internal systems** (e.g., ERP, CRM, order DB)
- **Deduplicate notifications** across multiple seller accounts (e.g., same SKU updates)
- **Handle cross-store logic** such as consolidated pricing or quantity controls across marketplaces

You can explore more handlers under:
- `lambda.subscription` – subscribe/unsubscribe logic
- `lambda.process.*` – different processing modes: internal, webhook, crossplatform

---

#### Java Code (Step Function Trigger Example)
```java
// Execute stepFunctions
StartExecutionRequest request = new StartExecutionRequest()
        .withStateMachineArn(stateMachineArn)
        .withInput(gson.toJson(inputForStepFunction))
        .withName("execution-" + UUID.randomUUID());

StartExecutionResult result = stepFunctionsClient.startExecution(request);
```

This allows highly flexible, stateful processing patterns per notification.

---

## Step Functions Integration Guide

To implement an advanced workflow with AWS Step Functions, you can define a sequence of Lambda functions for a specific notification type using the `StepFunctions` block in your app-config:

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

### Key Points:

- `Lambdas`: Specify the list of Lambda function class paths **in the order they are invoked** in the Step Function definition.
- `Definitions`: Provide the relative path to the Step Function definition file (in Amazon States Language).
- The definition file must reference Lambda ARNs that match the classes listed above and follow the logical flow you need.

### Credential Flow
Credentials (e.g., SP-API tokens, seller metadata) are passed from the initial notification handler Lambda and injected into the input of the Step Function. Therefore, downstream Lambdas in the workflow must be designed to **expect and consume these credentials** from the state input.

You can find implementation examples in:
- `step-functions/order-change-step-functions-workflow-definition.json`
- `lambda/process/internal/orderchange/stepfunctions/`

This pattern enables modular, auditable, and extensible workflows that can scale with complexity as your use case evolves.

---

##  References

- [SP-API Notifications API Reference](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference)
- [SP-API Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide)
- [Step Functions documentation](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html)
- [AWS Lambda Java documentation](https://docs.aws.amazon.com/lambda/latest/dg/java-handler.html)

---

For setup and deployment, refer back to [DEPLOYMENT.md](./DEPLOYMENT.md).
