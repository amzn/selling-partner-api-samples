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

import {
  getShipmentHandler,
  processShipmentHandler,
  createPackagesHandler,
  updatePackageHandler,
  updatePackageStatusHandler,
  retrieveShippingOptionsHandler,
  generateInvoiceHandler,
  generateShipLabelsHandler,
} from "../../src/operation/extFulfillmentShipmentsOperations.js";

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

/** Arbitrary for a line item */
const lineItemArb = fc.record({
  id: fc.uuid(),
  quantity: fc.integer({ min: 1, max: 100 }),
});

/** Arbitrary for a shipment entity suitable for processShipment testing */
const shipmentEntityArb = fc
  .record({
    id: fc.uuid(),
    _key: fc.uuid(),
    status: fc.constantFrom(...SHIPMENT_STATUSES),
    locationId: alphaNumStr,
    marketplaceAttributes: fc.record({
      marketplaceId: alphaNumStr,
      channelName: alphaNumStr,
    }),
    lineItems: fc.array(lineItemArb, { minLength: 1, maxLength: 5 }),
    lastUpdatedDateTime: fc.constant("2020-01-01T00:00:00.000Z"),
  })
  .map((r) => ({ ...r }) as Record<string, unknown>);

describe("Property-Based Tests: External Fulfillment Shipments (pbt2)", () => {
  beforeEach(() => {
    mockFind.mockReturnValue([]);
    mockPut.mockClear();
  });

  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * Property 8: processShipment status transition
   * For ANY shipment entity and ANY choice of CONFIRM or REJECT:
   * 1. After CONFIRM: entity.status === "CONFIRMED"
   * 2. After REJECT: entity.status === "CANCELLED"
   * 3. In both cases: lastUpdatedDateTime is updated (different from original)
   * 4. In both cases: handler returns 204
   * 5. In both cases: mockPut is called with the entity
   */
  describe("Property 8: processShipment status transition", () => {
    it("CONFIRM or REJECT sets the correct status, updates lastUpdatedDateTime, returns 204, and persists", async () => {
      await fc.assert(
        fc.asyncProperty(shipmentEntityArb, fc.constantFrom("CONFIRM", "REJECT"), async (entity, operation) => {
          mockPut.mockClear();

          // Store original timestamp for comparison
          const originalTimestamp = entity.lastUpdatedDateTime as string;

          // Build the validation result with the entity in resolvedEntities
          const validationResult = makeEntityValidationResult("processShipment", { shipment: entity }, { operation }, undefined, {
            shipmentId: entity.id as string,
          });

          const result = await processShipmentHandler(validationResult, {} as never);

          // Assertion 1 & 2: Status is correctly set
          if (operation === "CONFIRM") {
            expect(entity.status).toBe("CONFIRMED");
          } else {
            expect(entity.status).toBe("CANCELLED");
          }

          // Assertion 3: lastUpdatedDateTime has been updated from the original past date
          expect(entity.lastUpdatedDateTime).not.toBe(originalTimestamp);
          // Verify it's a valid ISO date string
          expect(new Date(entity.lastUpdatedDateTime as string).toISOString()).toBe(entity.lastUpdatedDateTime);

          // Assertion 4: Handler returns 204
          expect(result.statusCode).toBe(204);
          expect(result.data.body).toEqual({});

          // Assertion 5: mockPut is called with the correct arguments
          expect(mockPut).toHaveBeenCalledTimes(1);
          expect(mockPut).toHaveBeenCalledWith("extFulfillmentShipments", entity.id, entity);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 4.1, 4.2**
   *
   * Property 10: createPackages appends and preserves
   * For ANY entity with zero or more existing packages and ANY array of new package objects:
   * 1. After createPackages, entity.packages contains ALL previously existing packages followed by ALL new packages
   * 2. entity.status === "PACKAGE_CREATED"
   * 3. entity.lastUpdatedDateTime is updated
   * 4. Handler returns 204
   * 5. mockPut is called with the entity
   */
  describe("Property 10: createPackages appends and preserves", () => {
    /** Arbitrary for a single package object */
    const packageArb = fc.record({
      id: fc.uuid(),
      weight: fc.integer({ min: 1, max: 1000 }).map((n) => n / 10),
      dimensions: fc.record({
        length: fc.integer({ min: 1, max: 200 }),
        width: fc.integer({ min: 1, max: 200 }),
        height: fc.integer({ min: 1, max: 200 }),
      }),
    });

    /** Arbitrary for existing packages (0-5 items) */
    const existingPackagesArb = fc.array(packageArb, { minLength: 0, maxLength: 5 });

    /** Arbitrary for new packages to add (1-5 items) */
    const newPackagesArb = fc.array(packageArb, { minLength: 1, maxLength: 5 });

    /** Arbitrary for entity with packages field present */
    const entityWithPackagesArb = fc
      .tuple(
        fc.record({
          id: fc.uuid(),
          _key: fc.uuid(),
          status: fc.constantFrom(...SHIPMENT_STATUSES),
          locationId: alphaNumStr,
          lastUpdatedDateTime: fc.constant("2020-01-01T00:00:00.000Z"),
        }),
        existingPackagesArb,
      )
      .map(([base, packages]) => ({ ...base, packages }) as Record<string, unknown>);

    /** Arbitrary for entity with packages undefined or null (tests initialization) */
    const entityWithoutPackagesArb = fc
      .record({
        id: fc.uuid(),
        _key: fc.uuid(),
        status: fc.constantFrom(...SHIPMENT_STATUSES),
        locationId: alphaNumStr,
        lastUpdatedDateTime: fc.constant("2020-01-01T00:00:00.000Z"),
      })
      .chain((base) =>
        fc.constantFrom(undefined, null).map((packagesValue) => {
          const entity = { ...base } as Record<string, unknown>;
          entity.packages = packagesValue;
          return entity;
        }),
      );

    it("appends new packages to existing packages, sets status to PACKAGE_CREATED, updates timestamp, returns 204, and persists", async () => {
      await fc.assert(
        fc.asyncProperty(entityWithPackagesArb, newPackagesArb, async (entity, newPackages) => {
          mockPut.mockClear();

          // Snapshot existing packages before mutation
          const existingPackages = [...(entity.packages as Record<string, unknown>[])];
          const originalTimestamp = entity.lastUpdatedDateTime as string;

          const validationResult = makeEntityValidationResult(
            "createPackages",
            { shipment: entity },
            {},
            { packages: newPackages },
            { shipmentId: entity.id as string },
          );

          const result = await createPackagesHandler(validationResult, {} as never);

          // Assertion 1: entity.packages contains all existing + all new packages in order
          const finalPackages = entity.packages as Record<string, unknown>[];
          expect(finalPackages.length).toBe(existingPackages.length + newPackages.length);

          // Existing packages are preserved at the start
          for (let i = 0; i < existingPackages.length; i++) {
            expect(finalPackages[i]).toEqual(existingPackages[i]);
          }
          // New packages are appended after existing
          for (let i = 0; i < newPackages.length; i++) {
            expect(finalPackages[existingPackages.length + i]).toEqual(newPackages[i]);
          }

          // Assertion 2: status is PACKAGE_CREATED
          expect(entity.status).toBe("PACKAGE_CREATED");

          // Assertion 3: lastUpdatedDateTime is updated
          expect(entity.lastUpdatedDateTime).not.toBe(originalTimestamp);
          expect(new Date(entity.lastUpdatedDateTime as string).toISOString()).toBe(entity.lastUpdatedDateTime);

          // Assertion 4: handler returns 204
          expect(result.statusCode).toBe(204);
          expect(result.data.body).toEqual({});

          // Assertion 5: mockPut is called with the entity
          expect(mockPut).toHaveBeenCalledTimes(1);
          expect(mockPut).toHaveBeenCalledWith("extFulfillmentShipments", entity.id, entity);
        }),
        { numRuns: 100 },
      );
    });

    it("initializes packages array when undefined or null, then appends new packages correctly", async () => {
      await fc.assert(
        fc.asyncProperty(entityWithoutPackagesArb, newPackagesArb, async (entity, newPackages) => {
          mockPut.mockClear();

          const originalTimestamp = entity.lastUpdatedDateTime as string;

          const validationResult = makeEntityValidationResult(
            "createPackages",
            { shipment: entity },
            {},
            { packages: newPackages },
            { shipmentId: entity.id as string },
          );

          const result = await createPackagesHandler(validationResult, {} as never);

          // Assertion 1: entity.packages contains exactly the new packages (started from empty)
          const finalPackages = entity.packages as Record<string, unknown>[];
          expect(finalPackages.length).toBe(newPackages.length);
          for (let i = 0; i < newPackages.length; i++) {
            expect(finalPackages[i]).toEqual(newPackages[i]);
          }

          // Assertion 2: status is PACKAGE_CREATED
          expect(entity.status).toBe("PACKAGE_CREATED");

          // Assertion 3: lastUpdatedDateTime is updated
          expect(entity.lastUpdatedDateTime).not.toBe(originalTimestamp);
          expect(new Date(entity.lastUpdatedDateTime as string).toISOString()).toBe(entity.lastUpdatedDateTime);

          // Assertion 4: handler returns 204
          expect(result.statusCode).toBe(204);
          expect(result.data.body).toEqual({});

          // Assertion 5: mockPut is called with the entity
          expect(mockPut).toHaveBeenCalledTimes(1);
          expect(mockPut).toHaveBeenCalledWith("extFulfillmentShipments", entity.id, entity);
        }),
        { numRuns: 100 },
      );
    });
  });
});

describe("Property-Based Tests: External Fulfillment Shipments (REJECT lineItem cancellation)", () => {
  beforeEach(() => {
    mockFind.mockReturnValue([]);
    mockPut.mockClear();
  });

  /** Cancellation reasons */
  const CANCELLATION_REASONS = ["OUT_OF_STOCK", "CUSTOMER_REQUESTED"] as const;

  /** Arbitrary for an existing cancellation entry */
  const existingCancellationArb = fc.record({
    reason: fc.constantFrom(...CANCELLATION_REASONS),
    cancelledQuantity: fc.integer({ min: 1, max: 50 }),
    cancelledAt: fc.integer({ min: 1577836800000, max: 1893456000000 }).map((ts) => new Date(ts).toISOString()),
  });

  /** Arbitrary for a line item with existing cancellations (0-3) */
  const lineItemWithCancellationsArb = fc.record({
    id: fc.uuid(),
    quantity: fc.integer({ min: 1, max: 100 }),
    cancellations: fc.array(existingCancellationArb, { minLength: 0, maxLength: 3 }),
  });

  /** Arbitrary for an entity with 1-10 line items that have cancellations */
  const entityWithLineItemsArb = fc
    .record({
      _key: fc.uuid(),
      id: fc.uuid(),
      status: fc.constantFrom("CREATED", "ACCEPTED"),
      lineItems: fc.array(lineItemWithCancellationsArb, { minLength: 1, maxLength: 10 }),
      lastUpdatedDateTime: fc.integer({ min: 1577836800000, max: 1893456000000 }).map((ts) => new Date(ts).toISOString()),
    })
    .map((r) => r as Record<string, unknown>);

  /**
   * **Validates: Requirements 3.3, 3.4**
   *
   * Property 9: REJECT lineItem cancellation append
   * For ANY entity with N line items (some with existing cancellations) and ANY subset
   * of line item IDs in the request:
   * 1. Each matched line item has exactly one NEW cancellation appended (with correct reason,
   *    quantity, and cancelledAt timestamp)
   * 2. Non-matching IDs in the request are skipped without error
   * 3. Previously existing cancellations on ALL line items are preserved (not overwritten or removed)
   * 4. Line items not referenced in the request body remain unchanged
   */
  describe("Property 9: REJECT lineItem cancellation append", () => {
    it("matched items get cancellation appended, non-matching skipped, existing cancellations preserved", async () => {
      await fc.assert(
        fc.asyncProperty(
          entityWithLineItemsArb.chain((entity) => {
            const lineItems = entity.lineItems as Array<{ id: string; quantity: number; cancellations: unknown[] }>;
            const entityLineItemIds = lineItems.map((li) => li.id);

            // Generate a request with a mix of matching and non-matching IDs
            const matchingIdsArb = fc.subarray(entityLineItemIds, { minLength: 0 }).chain((ids) =>
              fc.tuple(
                fc.constant(ids),
                fc.array(fc.integer({ min: 1, max: 50 }), { minLength: ids.length, maxLength: ids.length }),
              ),
            );
            const nonMatchingIdsArb = fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }).chain((ids) =>
              fc.tuple(
                fc.constant(ids),
                fc.array(fc.integer({ min: 1, max: 50 }), { minLength: ids.length, maxLength: ids.length }),
              ),
            );

            return fc.tuple(fc.constant(entity), matchingIdsArb, nonMatchingIdsArb, fc.constantFrom(...CANCELLATION_REASONS));
          }),
          async ([entity, [matchingIds, matchingQuantities], [nonMatchingIds, nonMatchingQuantities], reason]) => {
            // Deep clone the entity so we can compare before/after
            const entityClone = JSON.parse(JSON.stringify(entity)) as Record<string, unknown>;
            const originalLineItems = JSON.parse(JSON.stringify(entity)) as Record<string, unknown>;

            // Build request body lineItems combining matching and non-matching IDs
            const requestLineItems = [
              ...matchingIds.map((id, i) => ({
                lineItem: { id, quantity: matchingQuantities[i] },
                reason,
              })),
              ...nonMatchingIds
                .filter((id) => !matchingIds.includes(id) && !(entity.lineItems as Array<{ id: string }>).some((li) => li.id === id))
                .map((id, i) => ({
                  lineItem: { id, quantity: nonMatchingQuantities[i] },
                  reason,
                })),
            ];

            const validationResult = makeEntityValidationResult(
              "processShipment",
              { shipment: entityClone },
              { operation: "REJECT" },
              { lineItems: requestLineItems } as unknown as Record<string, unknown>,
            );

            const result = await processShipmentHandler(validationResult, {} as never);

            // Handler should return 204 (success, no body)
            expect(result.statusCode).toBe(204);

            // Get the mutated entity from the validation result (handler mutates in place)
            const mutatedEntity = entityClone;
            const mutatedLineItems = mutatedEntity.lineItems as Array<{
              id: string;
              quantity: number;
              cancellations: Array<{ reason: string; cancelledQuantity: number; cancelledAt: string }>;
            }>;
            const originalLineItemsArr = (originalLineItems as { lineItems: Array<{ id: string; quantity: number; cancellations: unknown[] }> })
              .lineItems;

            // Assertion 1: Each matched line item has exactly one NEW cancellation appended
            for (const matchedId of matchingIds) {
              const mutatedLi = mutatedLineItems.find((li) => li.id === matchedId)!;
              const originalLi = originalLineItemsArr.find((li) => li.id === matchedId)!;
              const originalCancellationCount = originalLi.cancellations.length;

              // Should have exactly one more cancellation than before
              expect(mutatedLi.cancellations.length).toBe(originalCancellationCount + 1);

              // The new cancellation should be the last one
              const newCancellation = mutatedLi.cancellations[mutatedLi.cancellations.length - 1];
              expect(newCancellation.reason).toBe(reason);

              // Find the request entry for this ID to verify quantity
              const requestEntry = requestLineItems.find((rl) => rl.lineItem.id === matchedId)!;
              expect(newCancellation.cancelledQuantity).toBe(requestEntry.lineItem.quantity);

              // cancelledAt should be a valid ISO date string
              expect(new Date(newCancellation.cancelledAt).toISOString()).toBe(newCancellation.cancelledAt);
            }

            // Assertion 2: Non-matching IDs in the request are skipped without error
            // (The handler returned 204, so no error was thrown)

            // Assertion 3: Previously existing cancellations on ALL line items are preserved
            for (const originalLi of originalLineItemsArr) {
              const mutatedLi = mutatedLineItems.find((li) => li.id === originalLi.id)!;
              // All original cancellations should still be present at the beginning of the array
              for (let i = 0; i < originalLi.cancellations.length; i++) {
                expect(mutatedLi.cancellations[i]).toEqual(originalLi.cancellations[i]);
              }
            }

            // Assertion 4: Line items not referenced in the request body remain unchanged
            const requestedIds = new Set(requestLineItems.map((rl) => rl.lineItem.id));
            for (const originalLi of originalLineItemsArr) {
              if (!requestedIds.has(originalLi.id)) {
                const mutatedLi = mutatedLineItems.find((li) => li.id === originalLi.id)!;
                // Should have same number of cancellations (no new ones added)
                expect(mutatedLi.cancellations.length).toBe(originalLi.cancellations.length);
                // All cancellations should be identical
                expect(mutatedLi.cancellations).toEqual(originalLi.cancellations);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
