import { describe, it, expect, vi } from "vitest";
import { TriggerProcessor } from "../../src/trigger/TriggerProcessor.js";
import { Api } from "../../src/database/Context.js";

// Mock the registry to inject a test trigger with a condition
vi.mock("../../src/trigger/triggerRegistry.js", () => ({
  triggerRegistry: [
    {
      name: "Test DELETE condition trigger",
      description: "Fires on DELETE when previousEntity has status SHIPPED",
      on: {
        api: "orders",
        event: ["DELETE"],
        condition: (event: any) => {
          const target = event.type === "DELETE" ? event.previousEntity : event.entity;
          return target?.fulfillment?.fulfillmentStatus === "SHIPPED";
        },
      },
      handler: vi.fn(),
    },
  ],
}));

import { triggerRegistry } from "../../src/trigger/triggerRegistry.js";

describe("TriggerProcessor", () => {
  it("evaluates condition against previousEntity for DELETE events", async () => {
    const handler = (triggerRegistry[0] as any).handler;
    handler.mockReset();

    await TriggerProcessor.emit("DELETE", Api.ORDERS, "order-001", undefined, {
      orderId: "order-001",
      fulfillment: { fulfillmentStatus: "SHIPPED" },
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DELETE",
        previousEntity: expect.objectContaining({ fulfillment: { fulfillmentStatus: "SHIPPED" } }),
      }),
    );
  });

  it("does not fire when DELETE previousEntity does not match condition", async () => {
    const handler = (triggerRegistry[0] as any).handler;
    handler.mockReset();

    await TriggerProcessor.emit("DELETE", Api.ORDERS, "order-002", undefined, {
      orderId: "order-002",
      fulfillment: { fulfillmentStatus: "PENDING" },
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
