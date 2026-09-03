import { randomUUID } from "node:crypto";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DataEvent } from "../DataEvent.js";
import { Api, Context } from "../../database/Context.js";
import { getAllowedMarketplaceIds } from "../../marketplaceIds.js";

/** Lazily instantiated SQS client — shared across invocations within this handler. */
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
 */
function queueUrlFromArn(arn: string): string {
  const parts = arn.split(":");
  const region = parts[3];
  const accountId = parts[4];
  const queueName = parts[5];
  return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
}

/** Sandbox stand-in for the selling partner identifier, used when there is no per-order seller concept to read from. */
const SANDBOX_SELLER_ID = "sandbox-seller";

/**
 * Maps the internal Orders `fulfillmentStatus` (FulfillmentStatus enum in
 * res/models/orders_2026-01-01.json, e.g. "PARTIALLY_SHIPPED") to the
 * OrderChangeNotification schema's `Summary.OrderStatus` enum (e.g.
 * "PartiallyShipped"). Falls back to "Pending" — a schema-valid value — for
 * any status not in the map, so the notification never carries a value the
 * schema rejects.
 */
const ORDER_STATUS_MAP: Record<string, string> = {
  PENDING_AVAILABILITY: "PendingAvailability",
  PENDING: "Pending",
  UNSHIPPED: "Unshipped",
  PARTIALLY_SHIPPED: "PartiallyShipped",
  SHIPPED: "Shipped",
  CANCELLED: "Canceled",
  UNFULFILLABLE: "Unfulfillable",
};

function mapOrderStatus(rawFulfillmentStatus: string | undefined): string {
  if (rawFulfillmentStatus && rawFulfillmentStatus in ORDER_STATUS_MAP) {
    return ORDER_STATUS_MAP[rawFulfillmentStatus];
  }
  return "Pending";
}

/**
 * The set of values the schema's `Summary.OrderType` enum accepts. The internal
 * Orders entity has no order-type concept, so we default to "StandardOrder" and
 * only pass through an entity-supplied value when it is a schema-valid enum
 * member — keeping the emitted notification schema-valid (mirroring mapOrderStatus).
 */
const VALID_ORDER_TYPES = new Set(["StandardOrder", "LongLeadTimeOrder", "Preorder", "BackOrder", "SourcingOnDemandOrder"]);

function mapOrderType(rawOrderType: string | undefined): string {
  if (rawOrderType && VALID_ORDER_TYPES.has(rawOrderType)) {
    return rawOrderType;
  }
  return "StandardOrder";
}

/**
 * Builds an ORDER_CHANGE notification payload matching the SP-API notification schema.
 */
function buildNotificationPayload(event: DataEvent): Record<string, unknown> {
  const order = event.entity ?? {};
  const previousOrder = event.previousEntity ?? {};

  const now = new Date().toISOString();
  const orderId = (order.orderId as string) ?? event.id;
  const rawOrderStatus = order.fulfillment?.fulfillmentStatus as string | undefined;
  const rawPreviousStatus = previousOrder.fulfillment?.fulfillmentStatus as string | undefined;
  const orderStatus = mapOrderStatus(rawOrderStatus);
  const previousStatus = mapOrderStatus(rawPreviousStatus);

  const orderItems = (order.orderItems as Record<string, unknown>[] | undefined) ?? [];

  // Summary.MarketplaceId is a required, non-nullable string. Prefer the order's
  // own marketplace, falling back to the first marketplace allowed for the
  // configured region so the field is never empty.
  const marketplaceId = (order.salesChannel?.marketplaceId as string | undefined) ?? getAllowedMarketplaceIds()[0];

  // Summary.PurchaseDate is required but nullable. The internal entity has no
  // dedicated purchase date, so createdTime is the closest equivalent.
  const purchaseDate = (order.createdTime as string | undefined) ?? null;

  // Summary.DestinationPostalCode is required but nullable. The recipient's
  // address may be stored under `shippingAddress` (scenario/DB data) or
  // `deliveryAddress` (Orders UI); support both, defaulting to null.
  const recipientAddress = (order.recipient?.shippingAddress ?? order.recipient?.deliveryAddress) as Record<string, unknown> | undefined;
  const destinationPostalCode = (recipientAddress?.postalCode as string | undefined) ?? null;

  const orderType = mapOrderType(order.orderType as string | undefined);

  return {
    NotificationVersion: "1.0",
    NotificationType: "ORDER_CHANGE",
    PayloadVersion: "1.0",
    EventTime: now,
    Payload: {
      OrderChangeNotification: {
        NotificationLevel: "OrderLevel",
        SellerId: SANDBOX_SELLER_ID,
        AmazonOrderId: orderId,
        OrderChangeType: "OrderStatusChange",
        OrderChangeTrigger: {
          TimeOfOrderChange: now,
          ChangeReason: `Status changed from ${previousStatus} to ${orderStatus}`,
        },
        Summary: {
          MarketplaceId: marketplaceId,
          OrderStatus: orderStatus,
          PurchaseDate: purchaseDate,
          DestinationPostalCode: destinationPostalCode,
          FulfillmentType: (order.fulfillment?.fulfilledBy as string) === "AMAZON" ? "AFN" : "MFN",
          OrderType: orderType,
          OrderItems: orderItems.map((item: Record<string, unknown>) => ({
            OrderItemId: item.orderItemId,
            SellerSKU: (item.product as Record<string, unknown> | undefined)?.sellerSku,
            // Required by the schema but nullable; the internal item has no
            // supply source concept, so fall back to null when absent.
            SupplySourceId: (item.supplySourceId as string | undefined) ?? null,
            Quantity: item.quantityOrdered,
          })),
        },
      },
    },
    NotificationMetadata: {
      ApplicationId: "sandbox-app",
      SubscriptionId: "", // Populated below when subscription is found
      PublishTime: now,
      NotificationId: randomUUID(),
    },
  };
}

/**
 * Trigger handler: when an order's status changes (UPDATE event),
 * looks for an active ORDER_CHANGE subscription. If one exists and has
 * a valid SQS destination, sends the notification to the queue.
 *
 * The trigger fires on every order UPDATE (not just fulfillment-status
 * changes), so this handler guards against spurious notifications by
 * comparing the new and previous fulfillment status and returning early
 * when they are unchanged.
 *
 * Does nothing if no subscription exists (no error — subscriptions are optional).
 */
export async function sendOrderChangeNotification(event: DataEvent): Promise<void> {
  const newStatus = event.entity?.fulfillment?.fulfillmentStatus;
  const prevStatus = event.previousEntity?.fulfillment?.fulfillmentStatus;
  if (newStatus === prevStatus) {
    console.info("[Trigger] Order fulfillment status unchanged — skipping ORDER_CHANGE notification");
    return;
  }

  const engine = Context.instance.engine;

  // Find an active subscription for ORDER_CHANGE notifications
  const subscriptions = engine.find(Api.NOTIFICATIONS, {
    _type: "subscription",
    notificationType: "ORDER_CHANGE",
  });

  if (subscriptions.length === 0) {
    console.info("[Trigger] No ORDER_CHANGE subscription found — skipping notification");
    return;
  }

  const subscription = subscriptions[0];
  const destinationId = subscription.destinationId as string;

  // Resolve the destination
  const destinations = engine.find(Api.NOTIFICATIONS, {
    _type: "destination",
    destinationId,
  });

  if (destinations.length === 0) {
    console.warn("[Trigger] ORDER_CHANGE subscription references unknown destination — skipping");
    return;
  }

  const destination = destinations[0];
  const resource = destination.resource as { sqs?: { arn: string } } | undefined;

  if (!resource?.sqs) {
    console.warn("[Trigger] ORDER_CHANGE destination has no SQS resource configured — skipping");
    return;
  }

  // Build and send the notification
  const payload = buildNotificationPayload(event);
  (payload.NotificationMetadata as Record<string, unknown>).SubscriptionId = subscription.subscriptionId ?? subscription._key;

  const queueUrl = queueUrlFromArn(resource.sqs.arn);
  const client = getSqsClient();

  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(payload),
  });

  try {
    await client.send(command);
    console.info(`[Trigger] ORDER_CHANGE notification sent to ${queueUrl} for order ${event.id}`);
  } catch (error) {
    console.error(`[Trigger] Failed to send ORDER_CHANGE notification for order ${event.id}:`, error);
  }

  // Also persist the notification in the database for local inspection
  engine.put(
    Api.NOTIFICATIONS,
    `notification-${(payload.NotificationMetadata as Record<string, unknown>).NotificationId as string}`,
    {
      _type: "notification",
      ...payload,
    },
    { silent: true },
  );
}
