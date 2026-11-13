import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import fc from "fast-check";

// Mock the database Context module so engine.find always returns an empty array
vi.mock("../../src/database/Context.js", () => ({
  Api: { NOTIFICATIONS: "notifications" },
  Context: {
    instance: {
      engine: {
        find: vi.fn().mockReturnValue([]),
      },
    },
  },
}));

import { sendNotification } from "../../src/controller/notificationsManagementController.js";

function createMockRequest(body: Record<string, unknown>): Request {
  return { body } as unknown as Request;
}

function createMockResponse(): Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe("sendNotification Property Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 8: Missing subscription returns 404
   * **Validates: Requirements 8.4**
   *
   * For any notification payload where the extracted NotificationType has no matching subscription
   * in the notifications database partition, the send endpoint shall return a 404 status code
   * with an appropriate error message.
   */
  it("Property 8: Any notification type with no matching subscription returns 404", async () => {
    // Generate random non-empty strings as notification types
    const arbNotificationType = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

    await fc.assert(
      fc.asyncProperty(arbNotificationType, async (notificationType) => {
        const req = createMockRequest({ NotificationType: notificationType });
        const res = createMockResponse();

        await sendNotification(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          error: `No subscription exists for notification type '${notificationType}'`,
        });
      }),
      { numRuns: 100 },
    );
  });
});
