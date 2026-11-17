/**
 * Allowlist of notification type identifiers to download.
 * Each entry corresponds to a filename (without `.json` extension) in the upstream
 * `schemas/notifications/` directory of the `amzn/selling-partner-api-models` repository.
 *
 * Consumed by `scripts/fetchNotificationSchemas.ts` to filter which schemas are copied
 * into `res/notification-schemas/`.
 */
export const NOTIFICATION_SCHEMA_ALLOWLIST: string[] = ["OrderChangeNotification"];
