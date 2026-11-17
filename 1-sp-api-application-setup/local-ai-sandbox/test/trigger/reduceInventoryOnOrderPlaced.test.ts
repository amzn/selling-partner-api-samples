import { describe, it, expect, beforeEach } from "vitest";
import { Context, Api } from "../../src/database/Context.js";
import { reduceInventoryOnOrderPlaced } from "../../src/trigger/handlers/reduceInventoryOnOrderPlaced.js";
import { DataEvent } from "../../src/trigger/DataEvent.js";
import { listingKey } from "../../src/operation/listingsItemModel.js";

const SELLER = "AMY6FKRUBY7XV";

describe("reduceInventoryOnOrderPlaced", () => {
  beforeEach(() => {
    Context.reset();
  });

  it("reduces MFN listing inventory on DEFAULT channel", () => {
    const engine = Context.instance.engine;
    engine.put(
      Api.LISTINGS,
      listingKey(SELLER, "SKU-A"),
      { sku: "SKU-A", sellerId: SELLER, mfnAvailability: [{ fulfillmentChannelCode: "DEFAULT", quantity: 20 }] },
      { silent: true },
    );

    const event: DataEvent = {
      type: "INSERT",
      api: Api.ORDERS,
      id: "order-001",
      entity: {
        fulfillment: { fulfillmentStatus: "PENDING", fulfilledBy: "MERCHANT" },
        orderItems: [{ product: { sellerSku: "SKU-A" }, quantityOrdered: 3 }],
      },
    };

    reduceInventoryOnOrderPlaced(event);

    const listing = engine.get(Api.LISTINGS, listingKey(SELLER, "SKU-A"));
    expect((listing?.mfnAvailability as any[])[0].quantity).toBe(17);
  });

  it("reduces FBA inventory in the inventory partition", () => {
    const engine = Context.instance.engine;
    engine.put(Api.INVENTORY, "SKU-A", { sellerSku: "SKU-A", totalQuantity: 100, fulfillableQuantity: 80 }, { silent: true });

    const event: DataEvent = {
      type: "INSERT",
      api: Api.ORDERS,
      id: "order-002",
      entity: {
        fulfillment: { fulfillmentStatus: "PENDING", fulfilledBy: "AMAZON" },
        orderItems: [{ product: { sellerSku: "SKU-A" }, quantityOrdered: 5 }],
      },
    };

    reduceInventoryOnOrderPlaced(event);

    const inventory = engine.get(Api.INVENTORY, "SKU-A");
    expect(inventory?.totalQuantity).toBe(95);
    expect(inventory?.fulfillableQuantity).toBe(75);
  });

  it("does nothing when listing/inventory does not exist", () => {
    const engine = Context.instance.engine;

    const event: DataEvent = {
      type: "INSERT",
      api: Api.ORDERS,
      id: "order-003",
      entity: {
        fulfillment: { fulfillmentStatus: "PENDING", fulfilledBy: "MERCHANT" },
        orderItems: [{ product: { sellerSku: "NONEXISTENT" }, quantityOrdered: 5 }],
      },
    };

    reduceInventoryOnOrderPlaced(event);

    expect(engine.get(Api.LISTINGS, "NONEXISTENT")).toBeNull();
  });
});
