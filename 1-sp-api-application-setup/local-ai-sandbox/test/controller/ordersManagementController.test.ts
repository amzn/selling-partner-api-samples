import { describe, it, expect, vi, beforeEach } from "vitest";
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

function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

describe("ordersManagementController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createOrder", () => {
    it("returns 400 when body is undefined (e.g. non-JSON content type)", async () => {
      const req = createMockRequest({ body: undefined });
      const res = createMockResponse();

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Request body must be a valid JSON object" });
      expect(mockEngine.get).not.toHaveBeenCalled();
      expect(mockEngine.put).not.toHaveBeenCalled();
    });

    it("returns 400 when body is a non-object (string / array)", async () => {
      const badBodies: unknown[] = ["raw string", 42, ["not", "an", "object"]];
      for (const badBody of badBodies) {
        vi.clearAllMocks();
        const req = { body: badBody, params: {} } as unknown as Request;
        const res = createMockResponse();

        await createOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "Request body must be a valid JSON object" });
        expect(mockEngine.put).not.toHaveBeenCalled();
      }
    });

    it("returns 400 when orderId is missing from body", async () => {
      const req = createMockRequest({ body: { name: "test" } });
      const res = createMockResponse();

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Request body must contain an orderId field" });
    });

    it("returns 409 when orderId already exists", async () => {
      mockEngine.get.mockReturnValue({ orderId: "111-2222222-3333333" });
      const req = createMockRequest({ body: { orderId: "111-2222222-3333333" } });
      const res = createMockResponse();

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: "Order with orderId '111-2222222-3333333' already exists" });
    });

    it("creates the order and returns 201 with orderId", async () => {
      mockEngine.get.mockReturnValue(null);
      const body = { orderId: "111-2222222-3333333", createdTime: "2024-01-01T00:00:00Z" };
      const req = createMockRequest({ body });
      const res = createMockResponse();

      await createOrder(req, res);

      expect(mockEngine.put).toHaveBeenCalledWith("orders", "111-2222222-3333333", body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ orderId: "111-2222222-3333333" });
    });

    it("returns 500 on unexpected error", async () => {
      mockEngine.get.mockImplementation(() => {
        throw new Error("DB failure");
      });
      const req = createMockRequest({ body: { orderId: "111-2222222-3333333" } });
      const res = createMockResponse();

      await createOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });

  describe("updateOrder", () => {
    it("returns 400 when body is undefined (e.g. non-JSON content type)", async () => {
      const req = createMockRequest({ body: undefined });
      const res = createMockResponse();

      await updateOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Request body must be a valid JSON object" });
      expect(mockEngine.get).not.toHaveBeenCalled();
      expect(mockEngine.put).not.toHaveBeenCalled();
    });

    it("returns 400 when body is a non-object (string / array)", async () => {
      const badBodies: unknown[] = ["raw string", 42, ["not", "an", "object"]];
      for (const badBody of badBodies) {
        vi.clearAllMocks();
        const req = { body: badBody, params: {} } as unknown as Request;
        const res = createMockResponse();

        await updateOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "Request body must be a valid JSON object" });
        expect(mockEngine.put).not.toHaveBeenCalled();
      }
    });

    it("returns 400 when orderId is missing from body", async () => {
      const req = createMockRequest({ body: { name: "test" } });
      const res = createMockResponse();

      await updateOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Request body must contain an orderId field" });
    });

    it("returns 404 when order does not exist", async () => {
      mockEngine.get.mockReturnValue(null);
      const req = createMockRequest({ body: { orderId: "111-2222222-3333333" } });
      const res = createMockResponse();

      await updateOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Order with orderId '111-2222222-3333333' not found" });
    });

    it("updates the order and returns 200 with updated document", async () => {
      const existingOrder = { orderId: "111-2222222-3333333", status: "old" };
      const updatedOrder = { orderId: "111-2222222-3333333", status: "new", _key: "111-2222222-3333333" };
      mockEngine.get.mockReturnValueOnce(existingOrder).mockReturnValueOnce(updatedOrder);
      const body = { orderId: "111-2222222-3333333", status: "new" };
      const req = createMockRequest({ body });
      const res = createMockResponse();

      await updateOrder(req, res);

      expect(mockEngine.put).toHaveBeenCalledWith("orders", "111-2222222-3333333", body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ order: updatedOrder });
    });

    it("returns 500 on unexpected error", async () => {
      mockEngine.get.mockImplementation(() => {
        throw new Error("DB failure");
      });
      const req = createMockRequest({ body: { orderId: "111-2222222-3333333" } });
      const res = createMockResponse();

      await updateOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });

  describe("deleteOrder", () => {
    it("returns 400 when orderId path param is missing", async () => {
      const req = createMockRequest({ params: {} });
      const res = createMockResponse();

      await deleteOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "orderId path parameter is required" });
    });

    it("returns 404 when order does not exist", async () => {
      mockEngine.get.mockReturnValue(null);
      const req = createMockRequest({ params: { orderId: "111-2222222-3333333" } });
      const res = createMockResponse();

      await deleteOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Order with orderId '111-2222222-3333333' not found" });
    });

    it("deletes the order and returns 200 with success message", async () => {
      mockEngine.get.mockReturnValue({ orderId: "111-2222222-3333333" });
      mockEngine.remove.mockResolvedValue(true);
      const req = createMockRequest({ params: { orderId: "111-2222222-3333333" } });
      const res = createMockResponse();

      await deleteOrder(req, res);

      expect(mockEngine.remove).toHaveBeenCalledWith("orders", "111-2222222-3333333");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Order '111-2222222-3333333' deleted successfully" });
    });

    it("returns 500 on unexpected error", async () => {
      mockEngine.get.mockImplementation(() => {
        throw new Error("DB failure");
      });
      const req = createMockRequest({ params: { orderId: "111-2222222-3333333" } });
      const res = createMockResponse();

      await deleteOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });
});
