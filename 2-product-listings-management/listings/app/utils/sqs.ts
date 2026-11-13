import {
  QueueDeletedRecently,
  QueueDoesNotExist,
  QueueNameExists,
  ResourceNotFoundException,
} from "@aws-sdk/client-sqs";
import { serializeToJsonString } from "@/app/utils/serialization";
import {
  buildEventBusFilterRuleName,
  buildNotificationSQSQueueName,
  generateSQSQueueUrl,
} from "@/app/utils/aws";
import { buildSQSClient } from "@/app/utils/aws-clients-factory";

/**
 * Helper method to delete an SQS Queue.
 * @param awsAccountId the AWS Account Id.
 * @param region the AWS region.
 * @param queueName the SQS queue name.
 */
export async function deleteQueue(
  awsAccountId: string,
  region: string,
  queueName: string,
) {
  const sqs = buildSQSClient(region);
  try {
    await sqs.deleteQueue({
      QueueUrl: generateSQSQueueUrl(awsAccountId, region, queueName),
    });
  } catch (error) {
    console.log(serializeToJsonString(error));
    if (
      !(
        error instanceof ResourceNotFoundException ||
        error instanceof QueueDeletedRecently ||
        error instanceof QueueDoesNotExist
      )
    ) {
      throw {
        status: 500,
      };
    }
  }
}

/**
 * Helper method to create SQS Queue per Notification Type.
 *
 * @param notificationType Notification Type for which we will be creating a SQS queue.
 * @param region Region where the SQS queue will be created.
 * @param awsAccountId AWS Account ID where the SQS queue will be created.
 * @param eventBusName Event Bus which will be linked to the SQS queue.
 */
export async function createQueue(
  notificationType: string,
  region: string,
  awsAccountId: string,
  eventBusName: string,
) {
  const sqs = buildSQSClient(region);
  const sqsName = buildNotificationSQSQueueName(notificationType);
  try {
    await sqs.createQueue({
      QueueName: sqsName,
      Attributes: {
        VisibilityTimeout: "300",
        Policy: buildSqsPolicyForEventBus(
          region,
          awsAccountId,
          sqsName,
          eventBusName,
          buildEventBusFilterRuleName(notificationType),
        ),
      },
    });
  } catch (error: any) {
    if (!(error instanceof QueueNameExists)) {
      console.log(serializeToJsonString(error));
      throw {
        status: 500,
      };
    }
  }
}

// Obtain the SQS policy based on the EventBus and Rule associated with it.
// https://tinyurl.com/3uat2jhk
function buildSqsPolicyForEventBus(
  region: string,
  awsAccountId: string,
  queueName: string,
  eventBusName: string,
  eventBusRuleName: string,
) {
  return `
    {
      "Version": "2012-10-17",
      "Id": "SqsPolicy-${queueName}",
      "Statement": [
        {
          "Sid": "AWSEvents_custom-eventbus-ack-sqs-rule_dlq_sqs-rule-target",
          "Effect": "Allow",
          "Principal": {
            "Service": "events.amazonaws.com"
          },
          "Action": "sqs:SendMessage",
          "Resource": "arn:aws:sqs:${region}:${awsAccountId}:${queueName}",
          "Condition": {
            "ArnEquals": {
              "aws:SourceArn": "arn:aws:events:${region}:${awsAccountId}:rule/${eventBusName}/${eventBusRuleName}"
            }
          }
        }
      ]
    }
  `;
}
