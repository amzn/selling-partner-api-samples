import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

const mockFind = vi.fn<() => Record<string, unknown>[]>().mockReturnValue([]);
const mockPut = vi.fn();

vi.mock("../../src/database/Context.js", () => ({
  Api: { EXT_FULFILLMENT_SHIPMENTS: "extFulfillmentShipments" },
  Context: {
    get instance() {
      return { engine: { find: mockFind, put: mockPut } };
    },
  },
}));

import { updatePackageStatusHandler, retrieveShippingOptionsHandler, generateInvoiceHandler, generateShipLabelsHandler } from "../../src/operation/extFulfillmentShipmentsOperations.js";

function makeEntityValidationResult(
  operationId: string,
  resolvedEntities: Record<string, Record<string, unknown>> = {},
  queryParams: Record<string, string | string[] | undefined> = {},
  body?: Record<string, unknown>,
  pathParams: Record<string, string> = {},
): UnifiedValidationPass {
  return {
    pass: true,
    operationId,
    apiName: "External Fulfillment Shipments",
    apiVersion: "2024-09-11",
    pathParams,
    queryParams,
    body,
    resolvedEntities,
    operation: {},
  };
}

/** Valid package statuses for testing */
const PACKAGE_STATUSES = ["CREATED", "SHIPPED", "DELIVERED", "IN_TRANSIT", "RETURNED"] as const;

/** Non-propagating statuses (everything except SHIPPED and DELIVERED) */
const NON_PROPAGATING_STATUSES = ["CREATED", "IN_TRANSIT", "RETURNED"] as const;

/** Valid shipment status values */
const SHIPMENT_STATUSES = [
  "CREATED",
  "ACCEPTED",
  "CONFIRMED",
  "PACKAGE_CREATED",
  "PICKUP_SLOT_RETRIEVED",
  "INVOICE_GENERATED",
  "SHIPLABEL_GENERATED",
  "CANCELLED",
  "SHIPPED",
  "DELIVERED",
] as const;

/** Alphanumeric string arbitrary (1-20 chars) */
const alphaNumStr = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/);

describe("Property-Based Tests: External Fulfillment Shipments (pbt3)", () => {
  beforeEach(() => {
    mockFind.mockReturnValue([]);
    mockPut.mockClear();
  });

  /**
   * **Validates: Requirements 6.4, 6.5**
   *
   * Property 13: Shipment status propagation
   * For ANY entity with N packages (N >= 2) in various statuses:
   * 1. If after the update, every package has status "SHIPPED" → shipment status becomes "SHIPPED"
   * 2. If after the update, every package has status "DELIVERED" → shipment status becomes "DELIVERED"
   * 3. If packages have MIXED statuses (not all same propagating status) → shipment status is NOT changed by propagation
   */
  describe("Property 13: Shipment status propagation", () => {
    it("propagates to SHIPPED when all packages become SHIPPED after update", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 6 }).chain((numPackages) => {
            // Generate an entity with numPackages where N-1 are already SHIPPED
            // and the last one will be updated to SHIPPED
            const packageIds = fc.tuple(...Array.from({ length: numPackages }, () => fc.uuid()));
            const shipmentId = fc.uuid();
            const initialShipmentStatus = fc.constantFrom("CREATED", "CONFIRMED", "PACKAGE_CREATED", "IN_TRANSIT");

            return fc.tuple(shipmentId, packageIds, initialShipmentStatus).map(([sId, pIds, initialStatus]) => {
              // Build packages: all but last already have status SHIPPED
              const packages = pIds.map((id, idx) => ({
                id,
                status: idx < numPackages - 1 ? "SHIPPED" : "CREATED", // last one is NOT shipped yet
              }));
              const entity: Record<string, unknown> = {
                id: sId,
                _key: sId,
                status: initialStatus,
                packages,
                lastUpdatedDateTime: "2020-01-01T00:00:00.000Z",
              };
              const targetPackageId = pIds[numPackages - 1];
              return { entity, targetPackageId };
            });
          }),
          async ({ entity, targetPackageId }) => {
            mockPut.mockClear();

            const originalStatus = entity.status as string;

            const validationResult = makeEntityValidationResult(
              "updatePackageStatus",
              { shipment: entity },
              {},
              { status: "SHIPPED" },
              { shipmentId: entity.id as string, packageId: targetPackageId },
            );

            await updatePackageStatusHandler(validationResult, {} as never);

            // After update, target package status should be SHIPPED
            const packages = entity.packages as Array<Record<string, unknown>>;
            const targetPkg = packages.find((p) => p.id === targetPackageId);
            expect(targetPkg!.status).toBe("SHIPPED");

            // All packages are now SHIPPED, so shipment status should propagate to SHIPPED
            expect(entity.status).toBe("SHIPPED");
            expect(entity.status).not.toBe(originalStatus);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("propagates to DELIVERED when all packages become DELIVERED after update", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 6 }).chain((numPackages) => {
            const packageIds = fc.tuple(...Array.from({ length: numPackages }, () => fc.uuid()));
            const shipmentId = fc.uuid();
            const initialShipmentStatus = fc.constantFrom("SHIPPED", "CREATED", "CONFIRMED");

            return fc.tuple(shipmentId, packageIds, initialShipmentStatus).map(([sId, pIds, initialStatus]) => {
              // All but last already have status DELIVERED
              const packages = pIds.map((id, idx) => ({
                id,
                status: idx < numPackages - 1 ? "DELIVERED" : "SHIPPED", // last one is NOT delivered yet
              }));
              const entity: Record<string, unknown> = {
                id: sId,
                _key: sId,
                status: initialStatus,
                packages,
                lastUpdatedDateTime: "2020-01-01T00:00:00.000Z",
              };
              const targetPackageId = pIds[numPackages - 1];
              return { entity, targetPackageId };
            });
          }),
          async ({ entity, targetPackageId }) => {
            mockPut.mockClear();

            const validationResult = makeEntityValidationResult(
              "updatePackageStatus",
              { shipment: entity },
              {},
              { status: "DELIVERED" },
              { shipmentId: entity.id as string, packageId: targetPackageId },
            );

            await updatePackageStatusHandler(validationResult, {} as never);

            // After update, target package status should be DELIVERED
            const packages = entity.packages as Array<Record<string, unknown>>;
            const targetPkg = packages.find((p) => p.id === targetPackageId);
            expect(targetPkg!.status).toBe("DELIVERED");

            // All packages are now DELIVERED, so shipment status should propagate to DELIVERED
            expect(entity.status).toBe("DELIVERED");
          },
        ),
        { numRuns: 100 },
      );
    });

    it("does NOT propagate when packages have mixed statuses after update", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 6 }).chain((numPackages) => {
            const packageIds = fc.tuple(...Array.from({ length: numPackages }, () => fc.uuid()));
            const shipmentId = fc.uuid();
            const initialShipmentStatus = fc.constantFrom("CREATED", "CONFIRMED", "PACKAGE_CREATED");
            // The target status we'll set on the updated package
            const targetStatus = fc.constantFrom("SHIPPED", "DELIVERED");
            // A different status for at least one other package to ensure mix
            const differentStatus = fc.constantFrom(...NON_PROPAGATING_STATUSES);

            return fc.tuple(shipmentId, packageIds, initialShipmentStatus, targetStatus, differentStatus).map(
              ([sId, pIds, shipmentStatus, tStatus, dStatus]) => {
                // Build packages: set first package to a DIFFERENT status from targetStatus
                // to guarantee mixed statuses after the update
                const packages = pIds.map((id, idx) => {
                  if (idx === 0) {
                    // This package will have a status that differs from targetStatus
                    return { id, status: dStatus };
                  }
                  // All other packages (including target at the end) get some status
                  return { id, status: "CREATED" };
                });
                const entity: Record<string, unknown> = {
                  id: sId,
                  _key: sId,
                  status: shipmentStatus,
                  packages,
                  lastUpdatedDateTime: "2020-01-01T00:00:00.000Z",
                };
                // Target is the LAST package (index numPackages - 1)
                const targetPackageId = pIds[numPackages - 1];
                return { entity, targetPackageId, targetStatus: tStatus, originalShipmentStatus: shipmentStatus };
              },
            );
          }),
          async ({ entity, targetPackageId, targetStatus, originalShipmentStatus }) => {
            mockPut.mockClear();

            const validationResult = makeEntityValidationResult(
              "updatePackageStatus",
              { shipment: entity },
              {},
              { status: targetStatus },
              { shipmentId: entity.id as string, packageId: targetPackageId },
            );

            await updatePackageStatusHandler(validationResult, {} as never);

            // After update, target package should have the new status
            const packages = entity.packages as Array<Record<string, unknown>>;
            const targetPkg = packages.find((p) => p.id === targetPackageId);
            expect(targetPkg!.status).toBe(targetStatus);

            // But since packages[0] has a non-propagating status, shipment should NOT propagate
            // It should remain at its original status
            expect(entity.status).toBe(originalShipmentStatus);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 7.1, 7.2, 7.3**
   *
   * Property 14: retrieveShippingOptions determinism
   * For ANY entity with random shippingType:
   * 1. If shippingInfo.shippingType === "MARKETPLACE": returns exactly one shipping option
   *    with deterministic shippingOptionId = `so-{shipmentId}-{packageId}`, correct fixed values
   *    (carrierName: "ATS", etc.), AND recommendedShippingOption equals that option
   * 2. If shippingType is NOT "MARKETPLACE" (including undefined, null, "SELF_SHIP", random strings):
   *    returns empty shippingOptions array with NO recommendedShippingOption field
   * 3. The output is always deterministic — same inputs produce same outputs (call twice, verify identical)
   */
  describe("Property 14: retrieveShippingOptions determinism", () => {
    it("MARKETPLACE shippingType returns deterministic shipping option with correct fields", async () => {
      await fc.assert(
        fc.asyncProperty(alphaNumStr, alphaNumStr, async (shipmentId, packageId) => {
          const entity: Record<string, unknown> = {
            id: shipmentId,
            _key: "some-key",
            shippingInfo: { shippingType: "MARKETPLACE" },
          };

          const validationResult = makeEntityValidationResult("retrieveShippingOptions", { shipment: entity }, {}, undefined, {
            shipmentId,
            packageId,
          });

          const result = await retrieveShippingOptionsHandler(validationResult, {} as never);

          // Should return 200
          expect(result.statusCode).toBe(200);

          const body = result.data.body as {
            shippingOptions: Array<Record<string, unknown>>;
            recommendedShippingOption: Record<string, unknown>;
          };

          // Exactly one shipping option
          expect(body.shippingOptions).toHaveLength(1);

          const option = body.shippingOptions[0];
          const expectedOptionId = `so-${shipmentId}-${packageId}`;

          // Deterministic shippingOptionId
          expect(option.shippingOptionId).toBe(expectedOptionId);

          // Fixed values
          expect(option.carrierName).toBe("ATS");
          expect(option.shipBy).toBe("MARKETPLACE");
          expect(option.pickupWindow).toEqual({ startTime: "1612933142", endTime: "1612494142" });
          expect(option.timeSlot).toEqual({ startTime: "1612933142", endTime: "1612494142", handoverMethod: "PICKUP" });

          // recommendedShippingOption equals the option
          expect(body.recommendedShippingOption).toEqual(option);
        }),
        { numRuns: 100 },
      );
    });

    it("non-MARKETPLACE shippingType returns empty shippingOptions with no recommendedShippingOption", async () => {
      const nonMarketplaceShippingTypeArb = fc.oneof(
        fc.constant("SELF_SHIP"),
        alphaNumStr.filter((s) => s !== "MARKETPLACE"),
        fc.constant(""),
      );

      await fc.assert(
        fc.asyncProperty(alphaNumStr, alphaNumStr, nonMarketplaceShippingTypeArb, async (shipmentId, packageId, shippingType) => {
          const entity: Record<string, unknown> = {
            id: shipmentId,
            _key: "some-key",
            shippingInfo: { shippingType },
          };

          const validationResult = makeEntityValidationResult("retrieveShippingOptions", { shipment: entity }, {}, undefined, {
            shipmentId,
            packageId,
          });

          const result = await retrieveShippingOptionsHandler(validationResult, {} as never);

          // Should return 200
          expect(result.statusCode).toBe(200);

          const body = result.data.body as Record<string, unknown>;

          // Empty shippingOptions array
          expect(body.shippingOptions).toEqual([]);

          // No recommendedShippingOption field
          expect(body).not.toHaveProperty("recommendedShippingOption");
        }),
        { numRuns: 100 },
      );
    });

    it("undefined or missing shippingInfo returns empty shippingOptions with no recommendedShippingOption", async () => {
      const missingShippingInfoArb = fc.oneof(
        fc.constant(undefined as unknown as Record<string, unknown>),
        fc.constant({} as Record<string, unknown>),
      );

      await fc.assert(
        fc.asyncProperty(alphaNumStr, alphaNumStr, missingShippingInfoArb, async (shipmentId, packageId, shippingInfo) => {
          const entity: Record<string, unknown> = {
            id: shipmentId,
            _key: "some-key",
          };
          if (shippingInfo !== undefined) {
            entity.shippingInfo = shippingInfo;
          }

          const validationResult = makeEntityValidationResult("retrieveShippingOptions", { shipment: entity }, {}, undefined, {
            shipmentId,
            packageId,
          });

          const result = await retrieveShippingOptionsHandler(validationResult, {} as never);

          // Should return 200
          expect(result.statusCode).toBe(200);

          const body = result.data.body as Record<string, unknown>;

          // Empty shippingOptions array
          expect(body.shippingOptions).toEqual([]);

          // No recommendedShippingOption field
          expect(body).not.toHaveProperty("recommendedShippingOption");
        }),
        { numRuns: 100 },
      );
    });

    it("calling the handler twice with the same inputs produces identical outputs (determinism)", async () => {
      const shippingTypeArb = fc.oneof(fc.constant("MARKETPLACE"), fc.constant("SELF_SHIP"), alphaNumStr);

      await fc.assert(
        fc.asyncProperty(alphaNumStr, alphaNumStr, shippingTypeArb, async (shipmentId, packageId, shippingType) => {
          const makeEntity = () => ({
            id: shipmentId,
            _key: "some-key",
            shippingInfo: { shippingType },
          });

          const makeValidation = (entity: Record<string, unknown>) =>
            makeEntityValidationResult("retrieveShippingOptions", { shipment: entity }, {}, undefined, {
              shipmentId,
              packageId,
            });

          // Call 1
          const entity1 = makeEntity();
          const result1 = await retrieveShippingOptionsHandler(makeValidation(entity1), {} as never);

          // Call 2 (fresh entity with same data)
          const entity2 = makeEntity();
          const result2 = await retrieveShippingOptionsHandler(makeValidation(entity2), {} as never);

          // Both calls must produce identical status code and body
          expect(result1.statusCode).toBe(result2.statusCode);
          expect(result1.data.body).toEqual(result2.data.body);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 8.2**
   *
   * Property 15: generateInvoice state mutation
   * For ANY entity (with or without existing `shipmentRequirements` path):
   * 1. After calling generateInvoice, `entity.shipmentRequirements.invoice.status` === "AVAILABLE"
   * 2. `entity.lastUpdatedDateTime` is updated from the original value
   * 3. Handler calls mockPut with the entity
   * 4. Handler returns 200 with document response
   * 5. The nested path is created regardless of whether `shipmentRequirements`, `shipmentRequirements.invoice`, or neither existed before
   */
  describe("Property 15: generateInvoice state mutation", () => {
    /** Entity WITHOUT shipmentRequirements field */
    const entityWithoutShipmentRequirements = fc
      .record({
        id: fc.uuid(),
        _key: fc.uuid(),
        status: fc.constantFrom(...SHIPMENT_STATUSES),
        locationId: alphaNumStr,
        lastUpdatedDateTime: fc.constant("2020-01-01T00:00:00.000Z"),
      })
      .map((r) => r as Record<string, unknown>);

    /** Entity WITH shipmentRequirements: {} (no invoice) */
    const entityWithEmptyShipmentRequirements = fc
      .record({
        id: fc.uuid(),
        _key: fc.uuid(),
        status: fc.constantFrom(...SHIPMENT_STATUSES),
        locationId: alphaNumStr,
        lastUpdatedDateTime: fc.constant("2020-01-01T00:00:00.000Z"),
        shipmentRequirements: fc.constant({}),
      })
      .map((r) => r as Record<string, unknown>);

    /** Entity WITH shipmentRequirements: { invoice: {} } (no status) */
    const entityWithInvoiceNoStatus = fc
      .record({
        id: fc.uuid(),
        _key: fc.uuid(),
        status: fc.constantFrom(...SHIPMENT_STATUSES),
        locationId: alphaNumStr,
        lastUpdatedDateTime: fc.constant("2020-01-01T00:00:00.000Z"),
        shipmentRequirements: fc.constant({ invoice: {} }),
      })
      .map((r) => r as Record<string, unknown>);

    /** Entity WITH shipmentRequirements: { invoice: { status: "NOT_AVAILABLE" } } (existing status) */
    const entityWithExistingInvoiceStatus = fc
      .record({
        id: fc.uuid(),
        _key: fc.uuid(),
        status: fc.constantFrom(...SHIPMENT_STATUSES),
        locationId: alphaNumStr,
        lastUpdatedDateTime: fc.constant("2020-01-01T00:00:00.000Z"),
        shipmentRequirements: fc.constant({ invoice: { status: "NOT_AVAILABLE" } }),
      })
      .map((r) => r as Record<string, unknown>);

    /** Use fc.oneof to cover all 4 cases */
    const entityArb = fc.oneof(
      entityWithoutShipmentRequirements,
      entityWithEmptyShipmentRequirements,
      entityWithInvoiceNoStatus,
      entityWithExistingInvoiceStatus,
    );

    it("sets invoice.status to AVAILABLE, updates timestamp, persists entity, and returns 200 with document", async () => {
      await fc.assert(
        fc.asyncProperty(entityArb, async (entity) => {
          mockPut.mockClear();

          const originalTimestamp = entity.lastUpdatedDateTime as string;

          const validationResult = makeEntityValidationResult("generateInvoice", { shipment: entity }, {}, undefined, {
            shipmentId: entity.id as string,
          });

          const result = await generateInvoiceHandler(validationResult, { get: () => "localhost:9001" } as never);

          // Assertion 1: invoice.status is set to "AVAILABLE"
          const requirements = entity.shipmentRequirements as Record<string, unknown>;
          expect(requirements).toBeDefined();
          const invoice = requirements.invoice as Record<string, unknown>;
          expect(invoice).toBeDefined();
          expect(invoice.status).toBe("AVAILABLE");

          // Assertion 2: lastUpdatedDateTime is updated
          expect(entity.lastUpdatedDateTime).not.toBe(originalTimestamp);
          expect(new Date(entity.lastUpdatedDateTime as string).toISOString()).toBe(entity.lastUpdatedDateTime);

          // Assertion 3: mockPut called with correct args
          expect(mockPut).toHaveBeenCalledTimes(1);
          expect(mockPut).toHaveBeenCalledWith("extFulfillmentShipments", entity.id, entity);

          // Assertion 4: returns 200 with document response
          expect(result.statusCode).toBe(200);
          expect(result.data.body).toEqual({
            document: { format: "PDF", content: "http://localhost:9001/invoice.pdf" },
          });
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 9.1, 9.2, 9.3, 9.5**
   *
   * Property 16: generateShipLabels one-to-one mapping
   * For ANY array of packageIds (1-20):
   * 1. The response's `packageShipLabelList` contains exactly ONE entry per packageId with `status: "SUCCESS"`
   * 2. The count of entries equals the count of packageIds (one-to-one mapping)
   * 3. Each entry has the correct `packageId`, `shipLabelMetadata` (from courierSupportedAttributes), and `fileData.url`
   * 4. The entity's status is updated to "SHIPLABEL_GENERATED"
   * 5. The entity's `lastUpdatedDateTime` is updated
   * 6. Non-matching packageIds (not in entity's packages array) STILL get SUCCESS entries
   */
  describe("Property 16: generateShipLabels one-to-one mapping", () => {
    it("produces exactly one SUCCESS entry per packageId with correct metadata and updates entity status", async () => {
      // Generator for an entity with 1-10 packages
      const entityPackagesArb = fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }).map((ids) =>
        ids.map((id) => ({ id, status: "CREATED" })),
      );

      // Generator for courierSupportedAttributes (optional carrierName and trackingId)
      const courierAttrsArb = fc.oneof(
        fc.constant(undefined as { carrierName?: string; trackingId?: string } | undefined),
        fc.record({
          carrierName: fc.oneof(fc.constant(undefined as string | undefined), alphaNumStr),
          trackingId: fc.oneof(fc.constant(undefined as string | undefined), alphaNumStr),
        }),
      );

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          entityPackagesArb,
          courierAttrsArb,
          fc.constantFrom(...SHIPMENT_STATUSES),
          fc.integer({ min: 1, max: 20 }).chain((numIds) =>
            // Generate a mix of existing package IDs from entity and random non-matching IDs
            fc.tuple(fc.constant(numIds), fc.array(fc.uuid(), { minLength: numIds, maxLength: numIds })),
          ),
          async (shipmentId, entityPackages, courierAttrs, initialStatus, [_numIds, randomPackageIds]) => {
            mockPut.mockClear();

            // Mix some existing entity package IDs with random ones
            const existingIds = entityPackages.map((p) => p.id);
            // Take a random subset of existing IDs (0 to all) and combine with random IDs
            const mixedPackageIds = [
              ...existingIds.slice(0, Math.min(existingIds.length, Math.floor(randomPackageIds.length / 2))),
              ...randomPackageIds.slice(0, Math.max(1, randomPackageIds.length - Math.floor(existingIds.length / 2))),
            ];
            // Ensure at least 1 packageId
            const packageIds = mixedPackageIds.length > 0 ? mixedPackageIds : [randomPackageIds[0]];

            const entity: Record<string, unknown> = {
              id: shipmentId,
              _key: shipmentId,
              status: initialStatus,
              packages: entityPackages,
              lastUpdatedDateTime: "2020-01-01T00:00:00.000Z",
            };

            const body: Record<string, unknown> = { packageIds };
            if (courierAttrs !== undefined) {
              body.courierSupportedAttributes = courierAttrs;
            }

            const validationResult = makeEntityValidationResult("generateShipLabels", { shipment: entity }, {}, body, {
              shipmentId,
            });

            const result = await generateShipLabelsHandler(validationResult, { get: () => "localhost:9001" } as never);

            // Should return 200
            expect(result.statusCode).toBe(200);

            const responseBody = result.data.body as { packageShipLabelList: Array<Record<string, unknown>> };

            // Assertion 1 & 2: one-to-one mapping — count equals packageIds count
            expect(responseBody.packageShipLabelList).toHaveLength(packageIds.length);

            // Expected metadata values
            const expectedCarrierName = courierAttrs?.carrierName ?? "";
            const expectedTrackingId = courierAttrs?.trackingId ?? "";

            // Assertion 3: Each entry has correct packageId, metadata, fileData, and status
            for (let i = 0; i < packageIds.length; i++) {
              const entry = responseBody.packageShipLabelList[i];
              expect(entry.packageId).toBe(packageIds[i]);
              expect(entry.status).toBe("SUCCESS");
              expect(entry.shipLabelMetadata).toEqual({
                carrierName: expectedCarrierName,
                trackingId: expectedTrackingId,
              });
              expect(entry.fileData).toEqual({ url: "http://localhost:9001/label.png" });
            }

            // Assertion 4: Entity status updated to SHIPLABEL_GENERATED
            expect(entity.status).toBe("SHIPLABEL_GENERATED");

            // Assertion 5: lastUpdatedDateTime is updated from original
            expect(entity.lastUpdatedDateTime).not.toBe("2020-01-01T00:00:00.000Z");
            expect(new Date(entity.lastUpdatedDateTime as string).toISOString()).toBe(entity.lastUpdatedDateTime);

            // Assertion 6: mockPut called with the updated entity
            expect(mockPut).toHaveBeenCalledTimes(1);
            expect(mockPut).toHaveBeenCalledWith("extFulfillmentShipments", shipmentId, entity);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("non-matching packageIds (not in entity packages) still receive SUCCESS entries", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }).map((ids) => ids.map((id) => ({ id, status: "CREATED" }))),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          async (shipmentId, entityPackages, nonMatchingIds) => {
            mockPut.mockClear();

            // Ensure none of the nonMatchingIds are in the entity packages
            const existingIdSet = new Set(entityPackages.map((p) => p.id));
            const trulyNonMatching = nonMatchingIds.filter((id) => !existingIdSet.has(id));
            // Skip if all randomly matched (extremely unlikely but handle gracefully)
            if (trulyNonMatching.length === 0) return;

            const entity: Record<string, unknown> = {
              id: shipmentId,
              _key: shipmentId,
              status: "CONFIRMED",
              packages: entityPackages,
              lastUpdatedDateTime: "2020-01-01T00:00:00.000Z",
            };

            const validationResult = makeEntityValidationResult(
              "generateShipLabels",
              { shipment: entity },
              {},
              { packageIds: trulyNonMatching },
              { shipmentId },
            );

            const result = await generateShipLabelsHandler(validationResult, { get: () => "localhost:9001" } as never);

            expect(result.statusCode).toBe(200);

            const responseBody = result.data.body as { packageShipLabelList: Array<Record<string, unknown>> };

            // Every non-matching ID still gets a SUCCESS entry
            expect(responseBody.packageShipLabelList).toHaveLength(trulyNonMatching.length);
            for (let i = 0; i < trulyNonMatching.length; i++) {
              expect(responseBody.packageShipLabelList[i].packageId).toBe(trulyNonMatching[i]);
              expect(responseBody.packageShipLabelList[i].status).toBe("SUCCESS");
            }

            // Entity status still updated
            expect(entity.status).toBe("SHIPLABEL_GENERATED");
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
