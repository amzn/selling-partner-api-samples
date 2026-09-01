import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";
import { Api, Context } from "../../src/database/Context.js";
import { listScenarios, seedScenario, loadScenarios, __resetScenarioCacheForTests, type Scenario } from "../../src/controller/scenariosController.js";
import { MARKETPLACE_IDS_ALL } from "../../src/marketplaceIds.js";

interface TrackSummary {
  id: string;
  title: string;
  description: string;
  steps: Scenario["tracks"][number]["steps"];
  runnableCount: number;
}

interface ScenarioSummary {
  id: string;
  title: string;
  tagline: string;
  description: string;
  seedCount: number;
  tracks: TrackSummary[];
}

interface ListResponseBody {
  scenarios: ScenarioSummary[];
}

interface SeedResponseBody {
  scenarioId: string;
  title: string;
  seeded: Record<string, string[]>;
  seedCount: number;
  message: string;
}

interface MockRes {
  statusCode: number;
  body: unknown;
  status(code: number): MockRes;
  json(payload: unknown): MockRes;
}

function mockResponse(): Response & MockRes {
  const res: MockRes = {
    statusCode: 0,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & MockRes;
}

function seedRequest(scenarioId: string): Request {
  return { params: { scenarioId } } as unknown as Request;
}

interface SeededOrder {
  orderId: string;
  fulfillment: { fulfillmentStatus: string; fulfilledBy: string };
  orderItems: { orderItemId: string; quantityOrdered: number }[];
}

beforeEach(() => {
  Context.reset();
  __resetScenarioCacheForTests();
  vi.restoreAllMocks();
});

describe("scenario fixtures", () => {
  it("load and validate against the schema with unique ids", () => {
    const scenarios = loadScenarios();
    expect(scenarios.size).toBeGreaterThanOrEqual(1);
    expect(scenarios.has("launch-a-product")).toBe(true);
  });

  it("launch-a-product has 5 tracks", () => {
    const scenario = loadScenarios().get("launch-a-product");
    expect(scenario).toBeDefined();
    if (!scenario) return;
    expect(scenario.tracks).toHaveLength(5);
    const trackIds = scenario.tracks.map((t) => t.id);
    expect(trackIds).toContain("orders-mfn");
    expect(trackIds).toContain("orders-fba");
    expect(trackIds).toContain("repricing");
    expect(trackIds).toContain("returns");
    expect(trackIds).toContain("fba-inbound");
  });

  it("only seeds into valid Api namespaces with non-empty ids", () => {
    for (const scenario of loadScenarios().values()) {
      for (const seed of scenario.seed) {
        expect(Object.values(Api)).toContain(seed.api);
        expect(seed.id.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses marketplace IDs that pass region validation", () => {
    for (const scenario of loadScenarios().values()) {
      const text = JSON.stringify(scenario.seed);
      const matches = text.matchAll(/"marketplaceId":\s*"([^"]+)"/g);
      for (const match of matches) {
        expect(MARKETPLACE_IDS_ALL as readonly string[]).toContain(match[1]);
      }
    }
  });

  it("seeded MFN order satisfies confirmShipment preconditions", () => {
    const scenario = loadScenarios().get("launch-a-product");
    const mfnOrder = scenario?.seed.find((s) => s.id === "111-0000001-0000001")?.entity as unknown as SeededOrder;
    expect(mfnOrder).toBeDefined();
    expect(mfnOrder.fulfillment.fulfilledBy).toBe("MERCHANT");
    expect(mfnOrder.fulfillment.fulfillmentStatus).toBe("UNSHIPPED");
    expect(mfnOrder.orderItems.length).toBeGreaterThan(0);
  });

  it("seeded FBA order is fulfilled by AMAZON", () => {
    const scenario = loadScenarios().get("launch-a-product");
    const fbaOrder = scenario?.seed.find((s) => s.id === "111-0000002-0000002")?.entity as unknown as SeededOrder;
    expect(fbaOrder).toBeDefined();
    expect(fbaOrder.fulfillment.fulfilledBy).toBe("AMAZON");
  });
});

describe("GET /scenarios (listScenarios)", () => {
  it("returns scenarios with tracks and runnable counts", () => {
    const res = mockResponse();
    listScenarios({} as Request, res);
    expect(res.statusCode).toBe(200);
    const body = res.body as ListResponseBody;
    expect(body.scenarios.length).toBeGreaterThanOrEqual(1);
    const launch = body.scenarios.find((s) => s.id === "launch-a-product");
    expect(launch).toBeDefined();
    if (!launch) return;
    expect(launch.seedCount).toBe(5);
    expect(launch.tracks.length).toBe(5);
    const mfnTrack = launch.tracks.find((t) => t.id === "orders-mfn");
    expect(mfnTrack).toBeDefined();
    if (!mfnTrack) return;
    expect(mfnTrack.runnableCount).toBeGreaterThan(0);
  });
});

describe("POST /scenarios/:scenarioId/seed (seedScenario)", () => {
  it("writes all fixture entities into the database", () => {
    const res = mockResponse();
    seedScenario(seedRequest("launch-a-product"), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as SeedResponseBody).seedCount).toBe(5);

    expect(Context.instance.engine.get(Api.ORDERS, "111-0000001-0000001")?.orderId).toBe("111-0000001-0000001");
    expect(Context.instance.engine.get(Api.ORDERS, "111-0000002-0000002")?.orderId).toBe("111-0000002-0000002");
    expect(Context.instance.engine.get(Api.LISTINGS, "LAUNCH-SKU-001")?.sku).toBe("LAUNCH-SKU-001");
    expect(Context.instance.engine.get(Api.CATALOG, "B0LAUNCH01")?.asin).toBe("B0LAUNCH01");
    expect(Context.instance.engine.get(Api.INVENTORY, "LAUNCH-SKU-001")?.sellerSku).toBe("LAUNCH-SKU-001");
  });

  it("re-seeding resets entities to fixture state", () => {
    seedScenario(seedRequest("launch-a-product"), mockResponse());

    const engine = Context.instance.engine;
    const mutated = engine.get(Api.ORDERS, "111-0000001-0000001") as unknown as SeededOrder;
    mutated.fulfillment.fulfillmentStatus = "SHIPPED";
    engine.put(Api.ORDERS, "111-0000001-0000001", mutated as unknown as Record<string, unknown>);

    seedScenario(seedRequest("launch-a-product"), mockResponse());
    const reset = engine.get(Api.ORDERS, "111-0000001-0000001") as unknown as SeededOrder;
    expect(reset.fulfillment.fulfillmentStatus).toBe("UNSHIPPED");
  });

  it("returns 404 for an unknown scenario", () => {
    const res = mockResponse();
    seedScenario(seedRequest("does-not-exist"), res);
    expect(res.statusCode).toBe(404);
  });
});
