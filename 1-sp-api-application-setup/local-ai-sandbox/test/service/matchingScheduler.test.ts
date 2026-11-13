/**
 * The scheduler itself: start/stop behaviour, the disable switch, and the
 * guarantee that a failing sweep cannot take the process down.
 *
 * Imported statically on purpose. Resetting the module graph would give the
 * scheduler its own copy of the Context singleton, so writes it made would be
 * invisible to assertions here. The interval is read when the scheduler starts,
 * not at module load, so setting the env var per test is enough.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { Context, Api } from "../../src/database/Context.js";
import { listingKey, ISSUE_CODE_UNMATCHABLE } from "../../src/operation/listingsItemModel.js";
import { isMatchingSchedulerRunning, runMatchingSweep, startMatchingScheduler, stopMatchingScheduler } from "../../src/service/matchingScheduler.js";

const SELLER = "AMY6FKRUBY7XV";
const originalInterval = process.env.MATCHING_INTERVAL_MS;

afterEach(() => {
  // Always disarm, or a surviving timer would fire during a later test.
  stopMatchingScheduler();
  if (originalInterval === undefined) delete process.env.MATCHING_INTERVAL_MS;
  else process.env.MATCHING_INTERVAL_MS = originalInterval;
  vi.useRealTimers();
});

/** Writes an offer-only listing that matching will tag as unmatchable. */
function seedUnmatchableListing(sku: string) {
  Context.instance.engine.put(
    Api.LISTINGS,
    listingKey(SELLER, sku),
    { sku, sellerId: SELLER, marketplaceId: "ATVPDKIKX0DER", productType: "PRODUCT", requirements: "LISTING_OFFER_ONLY", issues: [], attributes: {} },
    { silent: true },
  );
}

function issueCodes(sku: string): string[] {
  const record = Context.instance.engine.get(Api.LISTINGS, listingKey(SELLER, sku));
  return ((record?.issues as { code: string }[] | undefined) ?? []).map((i) => i.code);
}

describe("startMatchingScheduler", () => {
  it("does not arm a timer when the interval is 0", () => {
    process.env.MATCHING_INTERVAL_MS = "0";
    startMatchingScheduler();
    expect(isMatchingSchedulerRunning()).toBe(false);
  });

  it("arms a timer when given an interval", () => {
    process.env.MATCHING_INTERVAL_MS = "60000";
    startMatchingScheduler();
    expect(isMatchingSchedulerRunning()).toBe(true);
    stopMatchingScheduler();
    expect(isMatchingSchedulerRunning()).toBe(false);
  });

  it("is idempotent, so a second call does not stack timers", () => {
    process.env.MATCHING_INTERVAL_MS = "60000";
    const spy = vi.spyOn(globalThis, "setInterval");
    startMatchingScheduler();
    startMatchingScheduler();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("rejects a nonsensical interval rather than silently defaulting", () => {
    process.env.MATCHING_INTERVAL_MS = "not-a-number";
    expect(() => {
      startMatchingScheduler();
    }).toThrow(/Invalid MATCHING_INTERVAL_MS/);
  });

  it("runs a sweep on each tick", () => {
    vi.useFakeTimers();
    Context.reset();
    seedUnmatchableListing("SWEEP-1");
    process.env.MATCHING_INTERVAL_MS = "60000";

    startMatchingScheduler();
    // Nothing has run yet: the first sweep is one interval away.
    expect(issueCodes("SWEEP-1")).toEqual([]);

    vi.advanceTimersByTime(60_000);
    expect(issueCodes("SWEEP-1")).toEqual([ISSUE_CODE_UNMATCHABLE]);
  });
});

describe("runMatchingSweep", () => {
  it("swallows a failure instead of propagating it", () => {
    const engineSpy = vi.spyOn(Context.instance.engine, "find").mockImplementation(() => {
      throw new Error("database exploded");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => {
      runMatchingSweep();
    }).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();

    engineSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
