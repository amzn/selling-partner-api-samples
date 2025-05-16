# SP-API Notification Receiver Infrastructure

This repository contains AWS CloudFormation templates to deploy two primary components:

1. **Cross-Account Notification Receiver (SQS + EventBridge)**
2. **Webhook Receiver (API Gateway + Lambda)**

These stacks are designed to help you receive notifications from the Amazon Selling Partner API (SP-API) through multiple channels including AWS SQS, Amazon EventBridge, or external systems via HTTPS webhooks.

---

## 1. Cross-Account Notification Receiver (SQS + EventBridge)

### Overview

This CloudFormation stack sets up:

* An Amazon SQS queue that allows `SendMessage` from a specified external AWS account
* An EventBridge EventBus with permission to receive events from the external account
* A Lambda function that processes messages from SQS
* A Lambda function that processes events from EventBridge

### Deployment

Deploy the stack using the AWS CLI:

```bash
aws cloudformation deploy \
  --template-file cross-account.yaml \
  --stack-name spapi-notification-cross-account \
  --capabilities CAPABILITY_NAMED_IAM
```

You can customize the external account ID by overriding the `ExternalAccountId` parameter:

```bash
--parameter-overrides ExternalAccountId=123456789012
```

### Outputs

* `SQSQueueUrl`: URL of the SQS queue that external account can send messages to
* `SQSQueueArn`: ARN of the SQS queue
* `EventBusName`: Name of the EventBridge EventBus
* `EventBusArn`: ARN of the EventBridge EventBus

---

## 2. Webhook Receiver (API Gateway + Lambda)

### Overview

This CloudFormation stack sets up:

* A Lambda function that validates an incoming `x-auth-token` header
* An HTTP API (API Gateway v2) with a `POST /webhook` route
* IAM permissions to allow API Gateway to invoke the Lambda

### Deployment

Deploy the stack using the AWS CLI:

```bash
aws cloudformation deploy \
  --template-file webhook-receiver.yaml \
  --stack-name spapi-notification-webhook \
  --capabilities CAPABILITY_NAMED_IAM
```

### Security Note

The webhook validates the `x-auth-token` header. You should customize the token value in the Lambda function to match your environment.

### Outputs

* `WebhookEndpoint`: The fully qualified API Gateway endpoint to send HTTP webhook messages to

---

## Example Use Cases

| Use Case                 | Setup             | Description                                                                              |
| ------------------------ | ----------------- | ---------------------------------------------------------------------------------------- |
| Internal AWS SQS         | Cross-Account SQS | Use if notifications are published to your SQS by another AWS account                    |
| AWS-native Event Routing | EventBridge       | Use if you want to handle high-throughput, low-latency events via EventBridge            |
| External System          | Webhook           | Use if you are receiving notifications from a custom HTTPS source or non-AWS application |

---

## Next Steps

1. Review CloudWatch logs for each Lambda after deployment
2. Configure SP-API or your external service to send notifications to the appropriate destination:

  * SQS ARN / URL
  * EventBridge EventBus ARN
  * Webhook HTTPS endpoint

---

