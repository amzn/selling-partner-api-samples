import { NOTIFICATION_TYPE_NORM_NAMES } from "@/app/constants/global";

/**
 * Helper method to generate the Event Bus Filter Rule name.
 * @param notificationType the notification type.
 */
export function buildEventBusFilterRuleName(notificationType: string) {
  const notificationNormName =
    NOTIFICATION_TYPE_NORM_NAMES.get(notificationType) ?? "";
  return `${notificationNormName}Rule`;
}

/**
 * Helper method to generate the SQS Queue name.
 * @param notificationType the notification type.
 */
export function buildNotificationSQSQueueName(notificationType: string) {
  const notificationNormName =
    NOTIFICATION_TYPE_NORM_NAMES.get(notificationType) ?? "";
  return `${notificationNormName}Queue`;
}

/**
 * Helper method to generate the SQS Arn for the notification Type.
 *
 * @param region Region of the SQS queue.
 * @param awsAccountId AWS account where the queue will be created.
 * @param notificationType Notification type for which the SQS Queue ARN will be generated.
 */
export function buildNotificationSQSQueueArn(
  region: string,
  awsAccountId: string,
  notificationType: string,
) {
  return `arn:aws:sqs:${region}:${awsAccountId}:${buildNotificationSQSQueueName(
    notificationType,
  )}`;
}

/**
 * Helper method to generate the SQS target name.
 * @param notificationType the notification type.
 */
export function buildNotificationSQSTargetName(notificationType: string) {
  const notificationNormName =
    NOTIFICATION_TYPE_NORM_NAMES.get(notificationType) ?? "";
  return `${notificationNormName}Target`;
}

/**
 * Helper method which generates the SQS Queue Url.
 * @param awsAccountId the AWS Account Id.
 * @param region the AWS region.
 * @param queueName the SQS queue name.
 */
export function generateSQSQueueUrl(
  awsAccountId: string,
  region: string,
  queueName: string,
) {
  return `https://sqs.${region}.amazonaws.com/${awsAccountId}/${queueName}`;
}
