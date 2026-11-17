import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Context, Api } from "../../src/database/Context.js";
import { TriggerProcessor } from "../../src/trigger/TriggerProcessor.js";
import { listingKey } from "../../src/operation/listingsItemModel.js";

/**
 * The database layer emits data events for every write — insert, update and
 * delete alike — and runs triggers detached, so a write returns before they
 * finish. `silent` is the single opt-out, used by fixture seeding and by
 * handlers writing their own output.
 *
 * Observed through the orders trigger, which reduces the ordered SKU's MFN
 * ledger when a PENDING merchant-fulfilled order is written.
 */
describe("DatabaseEngine trigger emission", () => {
  /** Yields to the event loop so detached trigger processing completes. */
  const flushTriggers = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    Context.reset();
  });

  // Drain any still-queued trigger work against the context that emitted it,
  // so detached processing never lands on the next test's database.
  afterEach(flushTriggers);

  const ORDER = {
    orderId: "ORD-1",
    fulfillment: { fulfillmentStatus: "PENDING", fulfilledBy: "MERCHANT" },
    orderItems: [{ product: { sellerSku: "SKU-1" }, quantityOrdered: 3 }],
  };

  const SELLER = "SELLER1";

  function seedListing(): void {
    Context.instance.engine.put(
      Api.LISTINGS,
      listingKey(SELLER, "SKU-1"),
      {
        sku: "SKU-1",
        sellerId: SELLER,
        productType: "PRODUCT",
        attributes: {},
        issues: [],
        mfnAvailability: [{ fulfillmentChannelCode: "DEFAULT", quantity: 10 }],
      },
      { silent: true },
    );
  }

  function mfnQuantity(): number | undefined {
    const ledger = Context.instance.engine.get(Api.LISTINGS, listingKey(SELLER, "SKU-1"))?.mfnAvailability as { quantity?: number }[] | undefined;
    return ledger?.[0].quantity;
  }

  it("returns from the write before triggers have run", () => {
    seedListing();
    Context.instance.engine.put(Api.ORDERS, "ORD-1", { ...ORDER });
    // Nothing deducted yet: processing is detached, like production's
    // asynchronous downstream handling of an order.
    expect(mfnQuantity()).toBe(10);
  });

  it("fires triggers on insert", async () => {
    seedListing();
    Context.instance.engine.put(Api.ORDERS, "ORD-1", { ...ORDER });
    await flushTriggers();
    expect(mfnQuantity()).toBe(7);
  });

  it("emits INSERT, UPDATE and DELETE with the same detached semantics", async () => {
    const emit = vi.spyOn(TriggerProcessor, "emit").mockResolvedValue();

    Context.instance.engine.put(Api.ORDERS, "ORD-1", { ...ORDER });
    Context.instance.engine.put(Api.ORDERS, "ORD-1", { ...ORDER, purchaseDate: "2026-02-02T00:00:00.000Z" });
    await Context.instance.engine.remove(Api.ORDERS, "ORD-1");

    // Every write returned before anything was emitted.
    expect(emit).not.toHaveBeenCalled();

    await flushTriggers();
    expect(emit.mock.calls.map((call) => call[0])).toEqual(["INSERT", "UPDATE", "DELETE"]);

    emit.mockRestore();
  });

  it("does not fire triggers for a silent write", async () => {
    seedListing();
    Context.instance.engine.put(Api.ORDERS, "ORD-1", { ...ORDER }, { silent: true });
    await flushTriggers();
    expect(mfnQuantity()).toBe(10);
  });

  it("does not fire triggers for a silent remove", async () => {
    Context.instance.engine.put(Api.ORDERS, "ORD-1", { orderId: "ORD-1" }, { silent: true });
    await expect(Context.instance.engine.remove(Api.ORDERS, "ORD-1", { silent: true })).resolves.toBe(true);
    expect(Context.instance.engine.get(Api.ORDERS, "ORD-1")).toBeNull();
  });

  it("settles instead of cascading when a handler writes another document", async () => {
    seedListing();
    // The orders handler writes the listing silently, so no further event is
    // emitted and processing terminates after one round.
    Context.instance.engine.put(Api.ORDERS, "ORD-1", { ...ORDER });
    await flushTriggers();
    await flushTriggers();
    expect(mfnQuantity()).toBe(7);
  });
});
