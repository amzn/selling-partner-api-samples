---
name: sandbox-notifications
description: This skill should be used when the user wants to work with SP-API notifications in the local Sample AI Sandbox — for example "send an ORDER_CHANGE notification", "set up a notification subscription", "test my notification handler", "why didn't my notification fire", "create a destination", or "show me the notification schemas". Covers destinations, subscriptions, sending notifications manually, and the order-status trigger that sends them automatically.
version: 1.0.0
---

# Driving sandbox notifications

Notifications in the sandbox work the way they do in production: you create a **destination** (an SQS queue), **subscribe** a notification type to it, and then notifications are delivered to that queue — either because something changed in the data, or because you sent one by hand.

The thing to understand first: **a notification with no matching subscription goes nowhere.** Both the manual send and the automatic trigger look up a subscription by notification type and do nothing if there is none. Most "why didn't my notification fire" questions are a missing subscription.

## The pieces

**Destinations and subscriptions** are created through the real SP-API Notifications operations, served by the sandbox. Call them against the base URL from `get_sandbox_context`. They are stored in the `notifications` namespace, with destinations and subscriptions distinguished by an internal `_type` discriminator — so if you inspect raw data with `get_data`, expect `_type: "subscription"` rather than two separate namespaces.

**Schemas.** `GET /manage/notifications/schemas` returns the notification payload schemas the sandbox ships. Currently that is `OrderChangeNotification`. The endpoint returns `[]` rather than an error when none are present, so an empty array means "none shipped", not "request failed".

**Manual send.** `POST /manage/notifications/send` takes a payload with a `NotificationType` field. It requires that field (400 without it) and requires a matching subscription to exist (404 without one). Use this to exercise a downstream handler without having to drive the data change that would naturally produce the notification.

**Automatic send.** `res/triggers.yaml` declares _Send ORDER_CHANGE notification on status change_: on any `UPDATE` to an order it sends an `ORDER_CHANGE` notification to the queue in the matching subscription, and does nothing when no `ORDER_CHANGE` subscription exists.

## Process

1. Call `get_sandbox_context` for the base URL and region.
2. Check what already exists before creating anything — list destinations and subscriptions. Re-creating a destination that is already there just adds confusion.
3. Create the destination, then the subscription for the notification type in question. The subscription is the part that actually routes.
4. Trigger the notification, by whichever route fits what the user is testing:
   - the **data path** — update an order's fulfillment status (for example via `confirmShipment`) and let the trigger fire, which is the realistic test; or
   - the **manual path** — `POST /manage/notifications/send`, which is faster and isolates the delivery from the data change.
5. Verify delivery at the queue. If nothing arrived, check in this order: does a subscription for that exact notification type exist, does its destination point where you are looking, and did the data change actually happen.

## Rules

- **Triggers run detached from the write.** The order update returns before the notification handler finishes, so an immediate check can miss it. Re-check once before concluding it did not fire.
- **Sending to a real SQS queue is an outward-facing action.** Confirm the queue is the user's own test queue before sending, and do not point a subscription at a queue you were not given.
- **Do not fake a notification by writing to the `notifications` namespace directly** to make a test pass. Use the real create/subscribe/send path, or the test proves nothing.
- `ORDER_CHANGE` is the type with both a shipped schema and an automatic trigger. For any other type, the manual send path is the one that works.
