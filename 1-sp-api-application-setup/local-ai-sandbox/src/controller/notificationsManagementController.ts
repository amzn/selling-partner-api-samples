import { Request, Response } from "express";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Api, Context } from "../database/Context.js";

const NOTIFICATION_SCHEMAS_DIR = path.resolve("res/notification-schemas");

/**
 * Converts a PascalCase filename (without extension) to UPPER_SNAKE_CASE notification type.
 * Strips trailing "Notification" suffix before conversion.
 * Example: "OrderChangeNotification" → "ORDER_CHANGE"
 */
export function deriveNotificationType(filename: string): string {
  // Strip file extension if present
  const baseName = filename.replace(/\.[^.]+$/, "");

  // Strip trailing "Notification" suffix
  const stripped = baseName.replace(/Notification$/, "");

  // Split PascalCase into words and convert to UPPER_SNAKE_CASE
  const words = stripped.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2");

  return words.toUpperCase();
}

/**
 * GET /manage/notifications/schemas
 * Returns an array of { notificationType, schema } objects for each JSON file
 * in the res/notification-schemas/ directory.
 */
export const getNotificationSchemas = async (_req: Request, res: Response): Promise<void> => {
  try {
    let files: string[];
    try {
      files = await readdir(NOTIFICATION_SCHEMAS_DIR);
    } catch {
      // Directory not found — return empty array
      res.status(200).json([]);
      return;
    }

    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    if (jsonFiles.length === 0) {
      res.status(200).json([]);
      return;
    }

    const schemas: { notificationType: string; schema: unknown }[] = [];

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(NOTIFICATION_SCHEMAS_DIR, file);
        const content = await readFile(filePath, "utf-8");
        const schema: unknown = JSON.parse(content);
        const notificationType = deriveNotificationType(file);
        schemas.push({ notificationType, schema });
      } catch (error) {
        console.warn(`Skipping invalid JSON file '${file}':`, error);
      }
    }

    res.status(200).json(schemas);
  } catch (error) {
    console.error("Error in getNotificationSchemas:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** Lazily instantiated SQS client — avoids startup cost when notifications are never used. */
let sqsClient: SQSClient | null = null;

function getSqsClient(): SQSClient {
  if (!sqsClient) {
    sqsClient = new SQSClient({});
  }
  return sqsClient;
}

/**
 * Extracts the SQS queue URL from an ARN.
 * ARN format: arn:aws:sqs:<region>:<account-id>:<queue-name>
 * Queue URL format: https://sqs.<region>.amazonaws.com/<account-id>/<queue-name>
 */
function queueUrlFromArn(arn: string): string {
  const parts = arn.split(":");
  const region = parts[3];
  const accountId = parts[4];
  const queueName = parts[5];
  return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
}

/**
 * POST /manage/notifications/send
 * Sends a notification payload to the SQS queue configured for the notification type's subscription.
 */
export const sendNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const notificationType = body.NotificationType as string | undefined;

    if (!notificationType) {
      res.status(400).json({ error: "NotificationType field is required in the payload" });
      return;
    }

    // Look up a subscription matching this notification type
    const subscriptions = Context.instance.engine.find(Api.NOTIFICATIONS, {
      _type: "subscription",
      notificationType,
    });

    if (subscriptions.length === 0) {
      res.status(404).json({ error: `No subscription exists for notification type '${notificationType}'` });
      return;
    }

    const subscription = subscriptions[0];
    const destinationId = subscription.destinationId as string;

    // Look up the destination by destinationId
    const destinations = Context.instance.engine.find(Api.NOTIFICATIONS, {
      _type: "destination",
      destinationId,
    });

    if (destinations.length === 0) {
      res.status(400).json({ error: "No valid SQS destination configured for this subscription" });
      return;
    }

    const destination = destinations[0];
    const resource = destination.resource as { sqs?: { arn: string } } | undefined;

    if (!resource?.sqs) {
      res.status(400).json({ error: "No valid SQS destination configured for this subscription" });
      return;
    }

    const queueUrl = queueUrlFromArn(resource.sqs.arn);
    const client = getSqsClient();

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(body),
    });

    const result = await client.send(command);
    res.status(200).json({ messageId: result.MessageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error in sendNotification:", error);
    res.status(500).json({ error: `Failed to send message to SQS: ${message}` });
  }
};
