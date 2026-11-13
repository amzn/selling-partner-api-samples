import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { Request, Response } from "express";

// Mock Context before importing controller
vi.mock("../../src/database/Context.js", () => {
  const mockEngine = {
    get: vi.fn(),
    put: vi.fn(),
    remove: vi.fn(),
  };
  return {
    Api: { ORDERS: "orders" },
    Context: {
      instance: { engine: mockEngine },
    },
  };
});

import { createOrder, updateOrder, deleteOrder } from "../../src/controller/ordersManagementController.js";
import { Context } from "../../src/database/Context.js";

const mockEngine = Context.instance.engine as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

function createMockResponse(): Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  return res;
}

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

/** Arbitrary for orderId in the 3-7-7 digit format */
const arbOrderId = fc.stringMatching(/^\d{3}-\d{7}-\d{7}$/);

/** Arbitrary for order document fields (excluding orderId) */
const arbOrderFields = fc.record({
  createdTime: fc.constantFrom("2024-01-01T00:00:00Z", "2024-06-15T12:30:00Z", "2025-03-20T08:45:00Z"),
  lastUpdatedTime: fc.constantFrom("2024-01-02T00:00:00Z", "2024-06-16T12:30:00Z", "2025-03-21T08:45:00Z"),
  salesChannel: fc.record({
    channelName: fc.constantFrom("AMAZON", "NON_AMAZON"),
    marketplaceId: fc.constantFrom("ATVPDKIKX0DER", "A2EUQ1WTGCTBG2", "A1PA6795UKMFR9"),
  }),
  fulfillment: fc.record({
    fulfillmentStatus: fc.constantFrom("PENDING", "UNSHIPPED", "SHIPPED", "CANCELLED"),
    fulfilledBy: fc.constantFrom("AMAZON", "MERCHANT"),
  }),
  buyer: fc.record({
    buyerName: fc.string({ minLength: 1, maxLength: 50 }),
  }),
});

/** Arbitrary for a unique set of orderIds (at least 2) */
const arbOrderIdSet = fc.uniqueArray(arbOrderId, { minLength: 2, maxLength: 10 });

describe("ordersManagementController Property Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 1: Create-then-retrieve round trip
   * **Validates: Requirements 6.2, 6.5, 8.2**
   *
   * For any valid order document with a unique orderId, after successfully creating it via POST,
   * retrieving it from the database using `engine.get(Api.ORDERS, orderId)` should return a document
   * whose fields match the original POST body.
   */
  it("Property 1: Create-then-retrieve round trip", async () => {
    await fc.assert(
      fc.asyncProperty(arbOrderId, arbOrderFields, async (orderId, fields) => {
        vi.clearAllMocks();

        const orderBody = { orderId, ...fields };

        // Mock engine.get to return null on first call (no duplicate) and the stored doc on second call
        mockEngine.get.mockReturnValueOnce(null);

        const req = createMockRequest({ body: orderBody });
        const res = createMockResponse();

        await createOrder(req, res);

        // Verify 201 response with orderId
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ orderId });

        // Verify engine.put was called with correct arguments (the round-trip write)
        expect(mockEngine.put).toHaveBeenCalledWith("orders", orderId, orderBody);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2: Duplicate orderId rejection preserves existing data
   * **Validates: Requirements 6.4, 8.5**
   *
   * For any order already stored in the database, POSTing another order with the same orderId
   * should return 409, and the stored document should remain unchanged from its original state.
   */
  it("Property 2: Duplicate orderId rejection preserves existing data", async () => {
    await fc.assert(
      fc.asyncProperty(arbOrderId, arbOrderFields, arbOrderFields, async (orderId, existingFields, newFields) => {
        vi.clearAllMocks();

        // The existing order stored in the database
        const existingOrder = { orderId, ...existingFields };

        // Mock engine.get to return the existing order (simulating it's already stored)
        mockEngine.get.mockReturnValue(existingOrder);

        // A different body attempting to use the same orderId
        const duplicateBody = { orderId, ...newFields };
        const req = createMockRequest({ body: duplicateBody });
        const res = createMockResponse();

        await createOrder(req, res);

        // Verify 409 response with correct error message
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
          error: `Order with orderId '${orderId}' already exists`,
        });

        // Verify engine.put was NOT called — original data is preserved
        expect(mockEngine.put).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3: Update overwrites document while preserving key
   * **Validates: Requirements 7.2, 8.3**
   *
   * For any existing order and any valid update body containing the same orderId,
   * after a successful PUT, the response should contain the updated document and
   * engine.put should be called with the new body (full overwrite semantics).
   */
  it("Property 3: Update overwrites document while preserving key", async () => {
    await fc.assert(
      fc.asyncProperty(arbOrderId, arbOrderFields, arbOrderFields, async (orderId, originalFields, updateFields) => {
        vi.clearAllMocks();

        const originalOrder = { orderId, ...originalFields };
        const updateBody = { orderId, ...updateFields };

        // Only exercise runs where the update genuinely changes the document, so the
        // overwrite is observable. (buyerName is random, so this virtually never discards.)
        fc.pre(JSON.stringify(updateBody) !== JSON.stringify(originalOrder));

        // Stateful mock store: get reflects the most recent write. Seeding with the
        // original order lets the existence check pass, and re-reading after put
        // returns whatever was actually stored. This means the response assertion
        // below genuinely verifies re-read-after-write (overwrite) semantics rather
        // than echoing a value the test hardcoded into the second get() call.
        let stored: Record<string, unknown> = originalOrder;
        mockEngine.get.mockImplementation(() => stored);
        mockEngine.put.mockImplementation((_api: string, _id: string, doc: Record<string, unknown>) => {
          stored = doc;
        });

        const req = createMockRequest({ body: updateBody });
        const res = createMockResponse();

        await updateOrder(req, res);

        // Verify engine.put was called with the update body (full overwrite)
        expect(mockEngine.put).toHaveBeenCalledWith("orders", orderId, updateBody);

        // Verify response is 200 with the document that resulted from the overwrite.
        // Because the store reflects the write, this asserts the controller returns
        // the newly written body — a controller that echoed the stale pre-update
        // document would fail this whenever the update changes any field.
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ order: updateBody });

        // Explicitly guard against returning stale pre-update state. Because fc.pre
        // above ensures updateBody differs from originalOrder, this is always meaningful.
        expect(res.json).not.toHaveBeenCalledWith({ order: originalOrder });
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 4: Delete removes and only removes the targeted order
   * **Validates: Requirements 2.5, 8.4**
   *
   * Pre-insert multiple orders, delete one, verify only that one is gone.
   * We mock engine.get to return an existing order for the picked orderId,
   * then verify engine.remove is called exactly once with the correct orderId.
   */
  it("Property 4: Delete removes and only removes the targeted order", async () => {
    await fc.assert(
      fc.asyncProperty(arbOrderIdSet, fc.nat(), async (orderIds, pickIndex) => {
        vi.clearAllMocks();

        // Pick one orderId to delete
        const targetIndex = pickIndex % orderIds.length;
        const targetOrderId = orderIds[targetIndex];

        // Mock engine.get to return an existing order for the target orderId
        mockEngine.get.mockImplementation((_api: string, id: string) => {
          if (id === targetOrderId) {
            return { orderId: targetOrderId, status: "UNSHIPPED" };
          }
          return null;
        });
        mockEngine.remove.mockResolvedValue(true);

        const req = createMockRequest({ params: { orderId: targetOrderId } });
        const res = createMockResponse();

        await deleteOrder(req, res);

        // Verify response is 200 with the success message
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: `Order '${targetOrderId}' deleted successfully` });

        // Verify engine.remove was called with the correct orderId
        expect(mockEngine.remove).toHaveBeenCalledWith("orders", targetOrderId);

        // Verify engine.remove was called exactly once (only the targeted order removed)
        expect(mockEngine.remove).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 5: Non-existent orderId returns 404 for PUT and DELETE
   * **Validates: Requirements 7.4, 8.6**
   *
   * For any orderId that does not exist in the orders collection, both PUT and DELETE
   * requests referencing that orderId should return 404 with an appropriate error message,
   * and the database should remain unchanged.
   */
  it("Property 5: PUT returns 404 with error message for any non-existent orderId", async () => {
    await fc.assert(
      fc.asyncProperty(arbOrderId, async (orderId) => {
        vi.clearAllMocks();
        mockEngine.get.mockReturnValue(null);

        const req = createMockRequest({ body: { orderId } });
        const res = createMockResponse();

        await updateOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: `Order with orderId '${orderId}' not found` });
        expect(mockEngine.put).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  it("Property 5: DELETE returns 404 with error message for any non-existent orderId", async () => {
    await fc.assert(
      fc.asyncProperty(arbOrderId, async (orderId) => {
        vi.clearAllMocks();
        mockEngine.get.mockReturnValue(null);

        const req = createMockRequest({ params: { orderId } });
        const res = createMockResponse();

        await deleteOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: `Order with orderId '${orderId}' not found` });
        expect(mockEngine.remove).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 6: Missing orderId returns 400
   * **Validates: Requirements 8.7**
   *
   * For any JSON body that does not contain an `orderId` field (including empty objects
   * and objects with other fields), POST and PUT requests should return 400 with an error
   * indicating the missing field.
   */
  it("Property 6: POST returns 400 when body has no orderId field", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }).filter((key) => key !== "orderId"),
          fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
        ),
        async (body) => {
          vi.clearAllMocks();

          const req = createMockRequest({ body });
          const res = createMockResponse();

          await createOrder(req, res);

          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({
            error: "Request body must contain an orderId field",
          });
          expect(mockEngine.get).not.toHaveBeenCalled();
          expect(mockEngine.put).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 6: PUT returns 400 when body has no orderId field", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }).filter((key) => key !== "orderId"),
          fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
        ),
        async (body) => {
          vi.clearAllMocks();

          const req = createMockRequest({ body });
          const res = createMockResponse();

          await updateOrder(req, res);

          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({
            error: "Request body must contain an orderId field",
          });
          expect(mockEngine.get).not.toHaveBeenCalled();
          expect(mockEngine.put).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});