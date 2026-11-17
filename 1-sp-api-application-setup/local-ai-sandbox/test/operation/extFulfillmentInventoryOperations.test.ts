import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

const mockGet = vi.fn<(api: string, key: string) => Record<string, unknown> | null>().mockReturnValue(null);
const mockPut = vi.fn();

vi.mock("../../src/database/Context.js", () => ({
  Api: { EXT_FULFILLMENT_INVENTORY: "extFulfillmentInventory" },
  Context: {
    get instance() {
      return { engine: { get: mockGet, put: mockPut } };
    },
  },
}));

import { batchInventoryHandler } from "../../src/operation/extFulfillmentInventoryOperations.js";

// --- Helpers ---

interface SubRequest {
  uri: string;
  method?: string;
  body?: Record<string, unknown>;
}

function makeValidationResult(requests: SubRequest[]): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "batchInventory",
    apiName: "External Fulfillment Inventory",
    apiVersion: "2024-09-11",
    pathParams: {},
    queryParams: {},
    body: { requests },
    resolvedEntities: {},
    operation: {},
  };
}

// --- Arbitraries ---

/** Alphanumeric string (1-20 chars) suitable for locationId/skuId */
const alphaNumStr = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/);

/** Positive integer for clientSequenceNumber */
const positiveInt = fc.integer({ min: 1, max: 2_147_483_647 });

/** Non-negative integer for quantity */
const nonNegInt = fc.integer({ min: 0, max: 2_147_483_647 });

/** Arbitrary marketplace attributes */
const marketplaceAttrsArb = fc.option(
  fc.record({
    marketplaceId: alphaNumStr,
    channelName: alphaNumStr,
  }),
  { nil: undefined },
);

/** A valid update sub-request */
const updateSubRequestArb = (locationId?: string, skuId?: string) =>
  fc
    .record({
      locId: locationId ? fc.constant(locationId) : alphaNumStr,
      sku: skuId ? fc.constant(skuId) : alphaNumStr,
      quantity: nonNegInt,
      clientSequenceNumber: positiveInt,
      marketplaceAttributes: marketplaceAttrsArb,
    })
    .map(({ locId, sku, quantity, clientSequenceNumber, marketplaceAttributes }) => ({
      uri: `/inventory/update?locationId=${locId}&skuId=${sku}`,
      method: "POST",
      body: { quantity, clientSequenceNumber, ...(marketplaceAttributes ? { marketplaceAttributes } : {}) },
    }));

/** A valid fetch sub-request */
const fetchSubRequestArb = (locationId?: string, skuId?: string) =>
  fc
    .record({
      locId: locationId ? fc.constant(locationId) : alphaNumStr,
      sku: skuId ? fc.constant(skuId) : alphaNumStr,
    })
    .map(({ locId, sku }) => ({
      uri: `/inventory/fetch?locationId=${locId}&skuId=${sku}`,
      method: "GET",
    }));

/** A valid sub-request (either update or fetch) */
const validSubRequestArb = fc.oneof(
  updateSubRequestArb(),
  fetchSubRequestArb(),
);

describe("Property-Based Tests: External Fulfillment Inventory", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockReturnValue(null);
    mockPut.mockReset();
  });

  /**
   * **Validates: Requirements 1.1, 6.2**
   *
   * Property 1: Batch response length and positional order
   * For any valid batch of 1 to 10 sub-requests, the handler returns an HTTP 207
   * response where the responses array has the same length as the input requests array.
   */
  describe("Property 1: Batch response length and positional order", () => {
    it("responses array length equals requests array length", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validSubRequestArb, { minLength: 1, maxLength: 10 }),
          async (requests) => {
            const validationResult = makeValidationResult(requests);
            const result = await batchInventoryHandler(validationResult, {} as never);

            expect(result.statusCode).toBe(207);
            const body = result.data.body as { responses: unknown[] };
            expect(body.responses.length).toBe(requests.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 1.5**
   *
   * Property 2: Unrecognized URI path returns error
   * For any sub-request whose URI path does not contain /inventory/update or /inventory/fetch,
   * the handler returns a per-item response with statusCode 400 and errorType INVALID_REQUEST.
   */
  describe("Property 2: Unrecognized URI path returns error", () => {
    /** Generate URIs that do NOT contain /inventory/update or /inventory/fetch */
    const badUriArb = fc
      .record({
        path: fc.constantFrom("/inventory/delete", "/stock/update", "/something/else", "/inv/fetch", ""),
        locId: alphaNumStr,
        sku: alphaNumStr,
      })
      .map(({ path, locId, sku }) => `${path}?locationId=${locId}&skuId=${sku}`);

    it("returns statusCode 400 with INVALID_REQUEST for unrecognized URI paths", async () => {
      await fc.assert(
        fc.asyncProperty(badUriArb, async (badUri) => {
          const requests: SubRequest[] = [{ uri: badUri, method: "POST" }];
          const validationResult = makeValidationResult(requests);
          const result = await batchInventoryHandler(validationResult, {} as never);

          expect(result.statusCode).toBe(207);
          const body = result.data.body as { responses: Array<{ status: { statusCode: number }; body: { actionableErrors: Array<{ errorType: string }> } }> };
          expect(body.responses.length).toBe(1);
          expect(body.responses[0].status.statusCode).toBe(400);
          expect(body.responses[0].body.actionableErrors[0].errorType).toBe("INVALID_REQUEST");
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 2.1, 2.3, 3.1, 7.1**
   *
   * Property 3: Insert-then-fetch round trip
   * For any valid inventory update followed by a fetch for the same locationId/skuId,
   * the fetched record contains the same sellableQuantity, clientSequenceNumber,
   * marketplaceAttributes, and reservedQuantity equal to 0.
   */
  describe("Property 3: Insert-then-fetch round trip", () => {
    it("fetch returns the record that was previously inserted via update", async () => {
      await fc.assert(
        fc.asyncProperty(
          alphaNumStr,
          alphaNumStr,
          nonNegInt,
          positiveInt,
          marketplaceAttrsArb,
          async (locationId, skuId, quantity, clientSequenceNumber, marketplaceAttributes) => {
            // Use a local Map to simulate stateful DB
            const db = new Map<string, Record<string, unknown>>();
            mockGet.mockImplementation((_api: string, key: string) => db.get(key) ?? null);
            mockPut.mockImplementation((_api: string, key: string, record: Record<string, unknown>) => {
              db.set(key, record);
            });

            const updateReq: SubRequest = {
              uri: `/inventory/update?locationId=${locationId}&skuId=${skuId}`,
              method: "POST",
              body: { quantity, clientSequenceNumber, ...(marketplaceAttributes ? { marketplaceAttributes } : {}) },
            };
            const fetchReq: SubRequest = {
              uri: `/inventory/fetch?locationId=${locationId}&skuId=${skuId}`,
              method: "GET",
            };

            const validationResult = makeValidationResult([updateReq, fetchReq]);
            const result = await batchInventoryHandler(validationResult, {} as never);

            const body = result.data.body as { responses: Array<{ status: { statusCode: number }; body: Record<string, unknown> }> };

            // Update should succeed
            expect(body.responses[0].status.statusCode).toBe(200);

            // Fetch should succeed and return the stored values
            expect(body.responses[1].status.statusCode).toBe(200);
            expect(body.responses[1].body.sellableQuantity).toBe(quantity);
            expect(body.responses[1].body.clientSequenceNumber).toBe(clientSequenceNumber);
            expect(body.responses[1].body.reservedQuantity).toBe(0);
            expect(body.responses[1].body.marketplaceAttributes).toEqual(marketplaceAttributes);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 2.2**
   *
   * Property 4: Update with higher sequence number preserves reservedQuantity
   * For any existing inventory record with reservedQuantity R, when an update provides
   * a clientSequenceNumber strictly greater than the stored value, the resulting record
   * has the new sellableQuantity, the new clientSequenceNumber, and reservedQuantity unchanged at R.
   */
  describe("Property 4: Update with higher sequence number preserves reservedQuantity", () => {
    it("preserves reservedQuantity after update with higher sequence number", async () => {
      await fc.assert(
        fc.asyncProperty(
          alphaNumStr,
          alphaNumStr,
          nonNegInt,
          nonNegInt,
          positiveInt,
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 0, max: 1000 }),
          marketplaceAttrsArb,
          async (locationId, skuId, initialQty, newQty, initialSeq, seqIncrement, reservedQuantity, marketplaceAttributes) => {
            const newSeq = initialSeq + seqIncrement + 1; // Ensure strictly greater

            // Simulate existing record
            const db = new Map<string, Record<string, unknown>>();
            const compositeKey = `${locationId}:${skuId}`;
            db.set(compositeKey, {
              locationId,
              skuId,
              sellableQuantity: initialQty,
              reservedQuantity,
              clientSequenceNumber: initialSeq,
              marketplaceAttributes: undefined,
            });

            mockGet.mockImplementation((_api: string, key: string) => db.get(key) ?? null);
            mockPut.mockImplementation((_api: string, key: string, record: Record<string, unknown>) => {
              db.set(key, record);
            });

            const updateReq: SubRequest = {
              uri: `/inventory/update?locationId=${locationId}&skuId=${skuId}`,
              method: "POST",
              body: { quantity: newQty, clientSequenceNumber: newSeq, ...(marketplaceAttributes ? { marketplaceAttributes } : {}) },
            };

            const validationResult = makeValidationResult([updateReq]);
            const result = await batchInventoryHandler(validationResult, {} as never);

            const body = result.data.body as { responses: Array<{ status: { statusCode: number }; body: Record<string, unknown> }> };
            expect(body.responses[0].status.statusCode).toBe(200);
            expect(body.responses[0].body.sellableQuantity).toBe(newQty);
            expect(body.responses[0].body.clientSequenceNumber).toBe(newSeq);
            expect(body.responses[0].body.reservedQuantity).toBe(reservedQuantity);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 2.4**
   *
   * Property 5: Stale clientSequenceNumber rejection
   * For any existing inventory record with stored clientSequenceNumber N, an update
   * with clientSequenceNumber <= N returns a per-item error with STALE_DATA
   * and does NOT modify the stored record.
   */
  describe("Property 5: Stale clientSequenceNumber rejection", () => {
    it("rejects update with stale clientSequenceNumber and does not modify stored record", async () => {
      await fc.assert(
        fc.asyncProperty(
          alphaNumStr,
          alphaNumStr,
          nonNegInt,
          positiveInt,
          nonNegInt,
          async (locationId, skuId, originalQty, storedSeq, staleOffset) => {
            const staleSeq = Math.max(1, storedSeq - staleOffset); // <= storedSeq

            const db = new Map<string, Record<string, unknown>>();
            const compositeKey = `${locationId}:${skuId}`;
            const originalRecord = {
              locationId,
              skuId,
              sellableQuantity: originalQty,
              reservedQuantity: 5,
              clientSequenceNumber: storedSeq,
              marketplaceAttributes: undefined,
            };
            db.set(compositeKey, { ...originalRecord });

            mockGet.mockImplementation((_api: string, key: string) => db.get(key) ?? null);
            mockPut.mockImplementation((_api: string, key: string, record: Record<string, unknown>) => {
              db.set(key, record);
            });

            const updateReq: SubRequest = {
              uri: `/inventory/update?locationId=${locationId}&skuId=${skuId}`,
              method: "POST",
              body: { quantity: 999, clientSequenceNumber: staleSeq },
            };

            const validationResult = makeValidationResult([updateReq]);
            const result = await batchInventoryHandler(validationResult, {} as never);

            const body = result.data.body as { responses: Array<{ status: { statusCode: number }; body: { actionableErrors: Array<{ errorType: string }> } }> };
            expect(body.responses[0].status.statusCode).toBe(400);
            expect(body.responses[0].body.actionableErrors[0].errorType).toBe("STALE_DATA");

            // Verify stored record was not modified
            const storedRecord = db.get(compositeKey);
            expect(storedRecord?.sellableQuantity).toBe(originalQty);
            expect(storedRecord?.clientSequenceNumber).toBe(storedSeq);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * Property 6: Fetch for non-existing key returns INVALID_SKU
   * For any locationId and skuId combination that does not exist in the database,
   * a fetch returns a per-item error with INVALID_SKU.
   */
  describe("Property 6: Fetch for non-existing key returns INVALID_SKU", () => {
    it("returns INVALID_SKU error for non-existing locationId:skuId", async () => {
      await fc.assert(
        fc.asyncProperty(alphaNumStr, alphaNumStr, async (locationId, skuId) => {
          // mockGet already returns null by default (reset in beforeEach)
          mockGet.mockReturnValue(null);

          const fetchReq: SubRequest = {
            uri: `/inventory/fetch?locationId=${locationId}&skuId=${skuId}`,
            method: "GET",
          };

          const validationResult = makeValidationResult([fetchReq]);
          const result = await batchInventoryHandler(validationResult, {} as never);

          const body = result.data.body as { responses: Array<{ status: { statusCode: number }; body: { actionableErrors: Array<{ errorType: string }> } }> };
          expect(body.responses[0].status.statusCode).toBe(400);
          expect(body.responses[0].body.actionableErrors[0].errorType).toBe("INVALID_SKU");
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * Property 7: Fetch ignores body marketplaceAttributes for lookup
   * For any existing inventory record, a fetch with arbitrary marketplaceAttributes
   * in its body returns the same result as a fetch with no marketplaceAttributes.
   */
  describe("Property 7: Fetch ignores body marketplaceAttributes for lookup", () => {
    it("fetch result is independent of body marketplaceAttributes", async () => {
      await fc.assert(
        fc.asyncProperty(
          alphaNumStr,
          alphaNumStr,
          nonNegInt,
          positiveInt,
          fc.record({ marketplaceId: alphaNumStr, channelName: alphaNumStr }),
          async (locationId, skuId, qty, seq, arbitraryAttrs) => {
            const compositeKey = `${locationId}:${skuId}`;
            const storedRecord = {
              locationId,
              skuId,
              sellableQuantity: qty,
              reservedQuantity: 0,
              clientSequenceNumber: seq,
              marketplaceAttributes: { marketplaceId: "STORED_MP", channelName: "STORED_CH" },
            };

            mockGet.mockImplementation((_api: string, key: string) => (key === compositeKey ? storedRecord : null));

            // Fetch with arbitrary body marketplaceAttributes
            const fetchWithAttrs: SubRequest = {
              uri: `/inventory/fetch?locationId=${locationId}&skuId=${skuId}`,
              method: "GET",
              body: { marketplaceAttributes: arbitraryAttrs },
            };

            // Fetch without body
            const fetchWithout: SubRequest = {
              uri: `/inventory/fetch?locationId=${locationId}&skuId=${skuId}`,
              method: "GET",
            };

            const result1 = await batchInventoryHandler(makeValidationResult([fetchWithAttrs]), {} as never);
            const result2 = await batchInventoryHandler(makeValidationResult([fetchWithout]), {} as never);

            const body1 = result1.data.body as { responses: Array<{ status: { statusCode: number }; body: Record<string, unknown> }> };
            const body2 = result2.data.body as { responses: Array<{ status: { statusCode: number }; body: Record<string, unknown> }> };

            // Both should return the same result
            expect(body1.responses[0].status.statusCode).toBe(body2.responses[0].status.statusCode);
            expect(body1.responses[0].body.sellableQuantity).toBe(body2.responses[0].body.sellableQuantity);
            expect(body1.responses[0].body.reservedQuantity).toBe(body2.responses[0].body.reservedQuantity);
            expect(body1.responses[0].body.clientSequenceNumber).toBe(body2.responses[0].body.clientSequenceNumber);
            expect(body1.responses[0].body.marketplaceAttributes).toEqual(body2.responses[0].body.marketplaceAttributes);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 7.4**
   *
   * Property 8: Location independence
   * For any two distinct locationId values sharing the same skuId, updating inventory
   * at one location does NOT modify the inventory record at the other location.
   */
  describe("Property 8: Location independence", () => {
    it("updating inventory at location L1 does not affect inventory at location L2", async () => {
      await fc.assert(
        fc.asyncProperty(
          alphaNumStr,
          alphaNumStr,
          alphaNumStr,
          nonNegInt,
          nonNegInt,
          positiveInt,
          positiveInt,
          async (location1, location2Suffix, skuId, qty1, qty2, seq1, seq2) => {
            // Ensure distinct locations
            const location2 = location1 + location2Suffix + "X";

            const db = new Map<string, Record<string, unknown>>();
            mockGet.mockImplementation((_api: string, key: string) => db.get(key) ?? null);
            mockPut.mockImplementation((_api: string, key: string, record: Record<string, unknown>) => {
              db.set(key, record);
            });

            // Insert at location1
            const update1: SubRequest = {
              uri: `/inventory/update?locationId=${location1}&skuId=${skuId}`,
              method: "POST",
              body: { quantity: qty1, clientSequenceNumber: seq1 },
            };

            // Insert at location2
            const update2: SubRequest = {
              uri: `/inventory/update?locationId=${location2}&skuId=${skuId}`,
              method: "POST",
              body: { quantity: qty2, clientSequenceNumber: seq2 },
            };

            await batchInventoryHandler(makeValidationResult([update1, update2]), {} as never);

            // Verify both records exist independently
            const key1 = `${location1}:${skuId}`;
            const key2 = `${location2}:${skuId}`;
            const record1 = db.get(key1);
            const record2 = db.get(key2);

            expect(record1).not.toBeNull();
            expect(record2).not.toBeNull();
            expect(record1?.sellableQuantity).toBe(qty1);
            expect(record2?.sellableQuantity).toBe(qty2);

            // Now update location1 with a higher sequence number
            const higherSeq = Math.max(seq1, seq2) + 1;
            const update1Again: SubRequest = {
              uri: `/inventory/update?locationId=${location1}&skuId=${skuId}`,
              method: "POST",
              body: { quantity: 0, clientSequenceNumber: higherSeq },
            };

            await batchInventoryHandler(makeValidationResult([update1Again]), {} as never);

            // location2 record should be unchanged
            const record2After = db.get(key2);
            expect(record2After?.sellableQuantity).toBe(qty2);
            expect(record2After?.clientSequenceNumber).toBe(seq2);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Validates: Requirements 6.1, 6.3**
   *
   * Property 9: Per-item error isolation in mixed batches
   * For any batch containing a mix of valid and invalid sub-requests, the handler
   * returns HTTP 207 with per-item success (200) for valid requests and per-item
   * error (400) for invalid requests. No valid sub-request's processing is affected
   * by the presence of an invalid sub-request.
   */
  describe("Property 9: Per-item error isolation in mixed batches", () => {
    /** Generate an invalid sub-request (unrecognized URI path) */
    const invalidSubRequestArb = alphaNumStr.map((id) => ({
      uri: `/inventory/unknown?locationId=${id}&skuId=${id}`,
      method: "POST",
    }));

    it("valid requests succeed and invalid requests fail independently in mixed batches", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              isValid: fc.boolean(),
              locationId: alphaNumStr,
              skuId: alphaNumStr,
              quantity: nonNegInt,
              clientSequenceNumber: positiveInt,
            }),
            { minLength: 2, maxLength: 10 },
          ),
          async (items) => {
            // Ensure at least one valid and one invalid
            if (items.every((i) => i.isValid) || items.every((i) => !i.isValid)) {
              // Force mix: flip first item
              items[0] = { ...items[0], isValid: !items[0].isValid };
            }

            const db = new Map<string, Record<string, unknown>>();
            mockGet.mockImplementation((_api: string, key: string) => db.get(key) ?? null);
            mockPut.mockImplementation((_api: string, key: string, record: Record<string, unknown>) => {
              db.set(key, record);
            });

            const requests: SubRequest[] = items.map((item) => {
              if (item.isValid) {
                return {
                  uri: `/inventory/update?locationId=${item.locationId}&skuId=${item.skuId}`,
                  method: "POST",
                  body: { quantity: item.quantity, clientSequenceNumber: item.clientSequenceNumber },
                };
              } else {
                return {
                  uri: `/inventory/unknown?locationId=${item.locationId}&skuId=${item.skuId}`,
                  method: "POST",
                };
              }
            });

            const validationResult = makeValidationResult(requests);
            const result = await batchInventoryHandler(validationResult, {} as never);

            expect(result.statusCode).toBe(207);
            const body = result.data.body as { responses: Array<{ status: { statusCode: number }; body: { actionableErrors: Array<{ errorType: string }> } }> };
            expect(body.responses.length).toBe(items.length);

            for (let i = 0; i < items.length; i++) {
              if (items[i].isValid) {
                expect(body.responses[i].status.statusCode).toBe(200);
              } else {
                expect(body.responses[i].status.statusCode).toBe(400);
                expect(body.responses[i].body.actionableErrors[0].errorType).toBe("INVALID_REQUEST");
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
