import { describe, it, expect, beforeEach } from "vitest";
import { Context, Api } from "../../src/database/Context.js";
import { getListingsRestrictionsHandler } from "../../src/operation/listingsRestrictionsOperations.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";
import type { Request } from "express";

const MP = "ATVPDKIKX0DER";

function makeValidationResult(queryParams: Record<string, unknown>): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "getListingsRestrictions",
    apiName: "Listings Restrictions",
    apiVersion: "2021-08-01",
    pathParams: {},
    queryParams: queryParams as Record<string, string | string[] | undefined>,
    body: undefined,
    resolvedEntities: {},
    operation: {},
  };
}

async function call(queryParams: Record<string, unknown>) {
  const result = await getListingsRestrictionsHandler(makeValidationResult(queryParams), {} as unknown as Request);
  return result.data.body as { restrictions: Record<string, unknown>[] };
}

describe("getListingsRestrictionsHandler", () => {
  beforeEach(() => {
    Context.reset();
  });

  it("returns empty restrictions for a catalog item without seeded restrictions", async () => {
    Context.instance.engine.put(Api.CATALOG, "B0FREE00001", { asin: "B0FREE00001" }, { silent: true });
    const body = await call({ asin: "B0FREE00001", sellerId: "SELLER1", marketplaceIds: MP });
    expect(body.restrictions).toEqual([]);
  });

  it("returns seeded restrictions filtered by marketplace", async () => {
    Context.instance.engine.put(Api.CATALOG, "B0LOCKED001", { asin: "B0LOCKED001" }, { silent: true });
    Context.instance.engine.put(
      Api.LISTINGS_RESTRICTIONS,
      "B0LOCKED001",
      {
        restrictions: [
          { marketplaceId: MP, conditionType: "new_new", reasons: [{ reasonCode: "APPROVAL_REQUIRED", message: "Approval required." }] },
          { marketplaceId: "A1F83G8C2ARO7P", conditionType: "new_new", reasons: [{ reasonCode: "NOT_ELIGIBLE" }] },
        ],
      },
      { silent: true },
    );

    const body = await call({ asin: "B0LOCKED001", sellerId: "SELLER1", marketplaceIds: MP });
    expect(body.restrictions).toHaveLength(1);
    expect(body.restrictions[0].marketplaceId).toBe(MP);
  });

  it("filters by conditionType when provided", async () => {
    Context.instance.engine.put(Api.CATALOG, "B0COND00001", { asin: "B0COND00001" }, { silent: true });
    Context.instance.engine.put(
      Api.LISTINGS_RESTRICTIONS,
      "B0COND00001",
      {
        restrictions: [
          { marketplaceId: MP, conditionType: "used_good", reasons: [{ reasonCode: "NOT_ELIGIBLE" }] },
          { marketplaceId: MP, conditionType: "new_new", reasons: [{ reasonCode: "APPROVAL_REQUIRED" }] },
        ],
      },
      { silent: true },
    );

    const body = await call({ asin: "B0COND00001", sellerId: "SELLER1", marketplaceIds: MP, conditionType: "used_good" });
    expect(body.restrictions).toHaveLength(1);
    expect(body.restrictions[0].conditionType).toBe("used_good");
  });

  it("answers ASIN_NOT_FOUND for an ASIN unknown to the catalog", async () => {
    const body = await call({ asin: "B0GHOST0001", sellerId: "SELLER1", marketplaceIds: MP });
    expect(body.restrictions).toHaveLength(1);
    const reasons = body.restrictions[0].reasons as { reasonCode: string }[];
    expect(reasons[0].reasonCode).toBe("ASIN_NOT_FOUND");
  });
});
