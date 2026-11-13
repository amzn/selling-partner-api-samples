import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

// Mock @aws-sdk/client-sqs
const mockSqsSend = vi.fn();
vi.mock("@aws-sdk/client-sqs", () => {
  return {
    SQSClient: class MockSQSClient {
      send = mockSqsSend;
    },
    SendMessageCommand: class MockSendMessageCommand {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

// Mock database Context
const mockFind = vi.fn();
vi.mock("../../src/database/Context.js", () => ({
  Api: { NOTIFICATIONS: "notifications" },
  Context: {
    instance: {
      engine: {
        find: (...args: unknown[]) => mockFind(...args),
      },
    },
  },
}));

import { deriveNotificationType, getNotificationSchemas, sendNotification } from "../../src/controller/notificationsManagementController.js";
import { readdir, readFile } from "node:fs/promises";

const mockReaddir = readdir as unknown as ReturnType<typeof vi.fn>;
const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>;

function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createMockRequest(body: Record<string, unknown> = {}): Request {
  return { body } as unknown as Request;
}

describe("notificationsManagementController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deriveNotificationType", () => {
    it("converts PascalCase with Notification suffix to UPPER_SNAKE_CASE", () => {
      expect(deriveNotificationType("OrderChangeNotification")).toBe("ORDER_CHANGE");
    });

    it("handles filename with .json extension", () => {
      expect(deriveNotificationType("OrderChangeNotification.json")).toBe("ORDER_CHANGE");
    });

    it("handles single word before Notification suffix", () => {
      expect(deriveNotificationType("ReportNotification")).toBe("REPORT");
    });

    it("handles multi-word names", () => {
      expect(deriveNotificationType("FulfillmentOrderStatusNotification")).toBe("FULFILLMENT_ORDER_STATUS");
    });

    it("handles names without Notification suffix", () => {
      expect(deriveNotificationType("OrderChange")).toBe("ORDER_CHANGE");
    });

    it("handles names with consecutive uppercase letters", () => {
      expect(deriveNotificationType("FBAInventoryNotification")).toBe("FBA_INVENTORY");
    });
  });

  describe("getNotificationSchemas", () => {
    it("returns schemas with correct notificationType derivation", async () => {
      const schemaContent = JSON.stringify({ type: "object", properties: {} });
      mockReaddir.mockResolvedValue(["OrderChangeNotification.json"]);
      mockReadFile.mockResolvedValue(schemaContent);

      const req = createMockRequest();
      const res = createMockResponse();

      await getNotificationSchemas(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ notificationType: "ORDER_CHANGE", schema: { type: "object", properties: {} } }]);
    });

    it("returns empty array when directory does not exist", async () => {
      mockReaddir.mockRejectedValue(new Error("ENOENT: no such file or directory"));

      const req = createMockRequest();
      const res = createMockResponse();

      await getNotificationSchemas(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it("returns empty array when directory has no JSON files", async () => {
      mockReaddir.mockResolvedValue(["readme.txt", ".DS_Store"]);

      const req = createMockRequest();
      const res = createMockResponse();

      await getNotificationSchemas(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it("skips invalid JSON files with a warning", async () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockReaddir.mockResolvedValue(["ValidNotification.json", "InvalidNotification.json"]);
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify({ valid: true }))
        .mockResolvedValueOnce("not valid json {{{");

      const req = createMockRequest();
      const res = createMockResponse();

      await getNotificationSchemas(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ notificationType: "VALID", schema: { valid: true } }]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Skipping invalid JSON file 'InvalidNotification.json'"), expect.anything());

      consoleSpy.mockRestore();
    });

    it("returns multiple schemas from multiple files", async () => {
      mockReaddir.mockResolvedValue(["OrderChangeNotification.json", "ReportProcessingNotification.json"]);
      mockReadFile
        .mockResolvedValueOnce(JSON.stringify({ type: "order" }))
        .mockResolvedValueOnce(JSON.stringify({ type: "report" }));

      const req = createMockRequest();
      const res = createMockResponse();

      await getNotificationSchemas(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([
        { notificationType: "ORDER_CHANGE", schema: { type: "order" } },
        { notificationType: "REPORT_PROCESSING", schema: { type: "report" } },
      ]);
    });
  });

  describe("sendNotification", () => {
    beforeEach(() => {
      mockFind.mockReset();
      mockSqsSend.mockReset();
    });

    it("returns 400 when NotificationType is missing from the payload", async () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      await sendNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "NotificationType field is required in the payload" });
    });

    it("returns 404 when no subscription exists for the notification type", async () => {
      mockFind.mockReturnValue([]);

      const req = createMockRequest({ NotificationType: "ORDER_CHANGE" });
      const res = createMockResponse();

      await sendNotification(req, res);

      expect(mockFind).toHaveBeenCalledWith("notifications", { _type: "subscription", notificationType: "ORDER_CHANGE" });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "No subscription exists for notification type 'ORDER_CHANGE'" });
    });

    it("returns 400 when no destination is found for the subscription", async () => {
      mockFind
        .mockReturnValueOnce([{ destinationId: "dest-1", notificationType: "ORDER_CHANGE" }]) // subscription found
        .mockReturnValueOnce([]); // no destination found

      const req = createMockRequest({ NotificationType: "ORDER_CHANGE" });
      const res = createMockResponse();

      await sendNotification(req, res);

      expect(mockFind).toHaveBeenCalledWith("notifications", { _type: "destination", destinationId: "dest-1" });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "No valid SQS destination configured for this subscription" });
    });

    it("returns 400 when destination has no SQS resource", async () => {
      mockFind
        .mockReturnValueOnce([{ destinationId: "dest-1", notificationType: "ORDER_CHANGE" }]) // subscription found
        .mockReturnValueOnce([{ destinationId: "dest-1", resource: {} }]); // destination without sqs

      const req = createMockRequest({ NotificationType: "ORDER_CHANGE" });
      const res = createMockResponse();

      await sendNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "No valid SQS destination configured for this subscription" });
    });

    it("returns 200 with messageId on successful SQS send", async () => {
      mockFind
        .mockReturnValueOnce([{ destinationId: "dest-1", notificationType: "ORDER_CHANGE" }])
        .mockReturnValueOnce([{ destinationId: "dest-1", resource: { sqs: { arn: "arn:aws:sqs:us-east-1:123456789012:my-queue" } } }]);
      mockSqsSend.mockResolvedValue({ MessageId: "msg-123" });

      const req = createMockRequest({ NotificationType: "ORDER_CHANGE", Payload: { orderId: "123" } });
      const res = createMockResponse();

      await sendNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ messageId: "msg-123" });
    });

    it("returns 500 when SQS client throws an error", async () => {
      mockFind
        .mockReturnValueOnce([{ destinationId: "dest-1", notificationType: "ORDER_CHANGE" }])
        .mockReturnValueOnce([{ destinationId: "dest-1", resource: { sqs: { arn: "arn:aws:sqs:us-east-1:123456789012:my-queue" } } }]);
      mockSqsSend.mockRejectedValue(new Error("SQS service unavailable"));

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = createMockRequest({ NotificationType: "ORDER_CHANGE", Payload: { orderId: "123" } });
      const res = createMockResponse();

      await sendNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to send message to SQS: SQS service unavailable" });

      consoleSpy.mockRestore();
    });
  });
});
