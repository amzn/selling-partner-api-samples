import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { Request, Response } from "express";

// Mock the database Context before importing the controller
vi.mock("../../src/database/Context.js", () => {
  const mockEngine = {
    find: vi.fn(),
  };
  return {
    Api: { NOTIFICATIONS: "notifications" },
    Context: {
      instance: { engine: mockEngine },
    },
  };
});

// Mock the SQS client to prevent real AWS calls
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(),
  SendMessageCommand: vi.fn(),
}));

import { sendNotification } from "../../src/controller/notificationsManagementController.js";
import { Context } from "../../src/database/Context.js";

const mockFind = Context.instance.engine.find as unknown as ReturnType<typeof vi.fn>;

function createMockResponse(): Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  return res;
}

function createMockRequest(body: Record<string, unknown>): Request {
  return { body } as unknown as Request;
}

/** Arbitrary for notification type strings (UPPER_SNAKE_CASE) */
const arbNotificationType = fc
  .array(fc.constantFrom("ORDER", "CHANGE", "REPORT", "ITEM", "LISTING", "FULFILLMENT", "INVENTORY", "PRICING", "STATUS"), { minLength: 1, maxLength: 3 })
  .map((words) => words.join("_"));

/** Arbitrary for destination IDs (UUID-like strings) */
const arbDestinationId = fc.uuid();

/** Arbitrary for a destination record that does NOT have an sqs resource */
const arbInvalidDestination = fc.oneof(
  // Destination with empty resource object
  arbDestinationId.map((id) => ({
    _key: id,
    _type: "destination" as const,
    destinationId: id,
    name: "test-destination",
    resource: {},
  })),
  // Destination with eventBridge resource (no sqs)
  arbDestinationId.map((id) => ({
    _key: id,
    _type: "destination" as const,
    destinationId: id,
    name: "test-destination",
    resource: { eventBridge: { accountId: "123456789012", region: "us-east-1" } },
  })),
  // Destination with undefined resource
  arbDestinationId.map((id) => ({
    _key: id,
    _type: "destination" as const,
    destinationId: id,
    name: "test-destination",
    resource: undefined,
  })),
);

describe("sendNotification Property Tests — Missing/Invalid SQS Destination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 9: Missing or invalid SQS destination returns 400
   * **Validates: Requirements 8.6**
   *
   * For any notification payload where the subscription's destinationId references a destination
   * that does not exist in the database, the send endpoint shall return a 400 status code with
   * an appropriate error message.
   */
  it("Property 9a: Non-existent destination returns 400", async () => {
    await fc.assert(
      fc.asyncProperty(arbNotificationType, arbDestinationId, async (notificationType, destinationId) => {
        vi.clearAllMocks();

        // Mock find: return a subscription for the subscription query, empty array for destination query
        mockFind.mockImplementation((_api: string, query: Record<string, unknown>) => {
          if (query._type === "subscription") {
            return [
              {
                _key: "sub-1",
                _type: "subscription",
                subscriptionId: "sub-1",
                notificationType,
                payloadVersion: "1.0",
                destinationId,
              },
            ];
          }
          if (query._type === "destination") {
            // No destination found
            return [];
          }
          return [];
        });

        const req = createMockRequest({
          NotificationType: notificationType,
          NotificationVersion: "1.0",
          PayloadVersion: "1.0",
          EventTime: "2024-01-01T00:00:00Z",
          Payload: {},
        });
        const res = createMockResponse();

        await sendNotification(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "No valid SQS destination configured for this subscription",
        });
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 9b: Destination without sqs resource returns 400
   * **Validates: Requirements 8.6**
   *
   * For any notification payload where the subscription's destinationId references a destination
   * that exists but lacks an sqs resource specification, the send endpoint shall return a 400
   * status code with an appropriate error message.
   */
  it("Property 9b: Destination without sqs resource returns 400", async () => {
    await fc.assert(
      fc.asyncProperty(arbNotificationType, arbInvalidDestination, async (notificationType, invalidDestination) => {
        vi.clearAllMocks();

        const destinationId = invalidDestination.destinationId;

        // Mock find: return subscription for subscription query, invalid destination for destination query
        mockFind.mockImplementation((_api: string, query: Record<string, unknown>) => {
          if (query._type === "subscription") {
            return [
              {
                _key: "sub-1",
                _type: "subscription",
                subscriptionId: "sub-1",
                notificationType,
                payloadVersion: "1.0",
                destinationId,
              },
            ];
          }
          if (query._type === "destination") {
            return [invalidDestination];
          }
          return [];
        });

        const req = createMockRequest({
          NotificationType: notificationType,
          NotificationVersion: "1.0",
          PayloadVersion: "1.0",
          EventTime: "2024-01-01T00:00:00Z",
          Payload: {},
        });
        const res = createMockResponse();

        await sendNotification(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "No valid SQS destination configured for this subscription",
        });
      }),
      { numRuns: 100 },
    );
  });
});
