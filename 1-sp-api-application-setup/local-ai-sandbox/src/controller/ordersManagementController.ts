import { Request, Response } from "express";
import { Api, Context } from "../database/Context.js";

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const body: unknown = req.body;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      res.status(400).json({ error: "Request body must be a valid JSON object" });
      return;
    }

    const order = body as Record<string, unknown>;
    const orderId = order.orderId as string | undefined;

    if (!orderId) {
      res.status(400).json({ error: "Request body must contain an orderId field" });
      return;
    }

    const existing = Context.instance.engine.get(Api.ORDERS, orderId);
    if (existing) {
      res.status(409).json({ error: `Order with orderId '${orderId}' already exists` });
      return;
    }

    Context.instance.engine.put(Api.ORDERS, orderId, order);
    res.status(201).json({ orderId });
  } catch (error) {
    console.error("Error in createOrder:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const body: unknown = req.body;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      res.status(400).json({ error: "Request body must be a valid JSON object" });
      return;
    }

    const order = body as Record<string, unknown>;
    const orderId = order.orderId as string | undefined;

    if (!orderId) {
      res.status(400).json({ error: "Request body must contain an orderId field" });
      return;
    }

    const existing = Context.instance.engine.get(Api.ORDERS, orderId);
    if (!existing) {
      res.status(404).json({ error: `Order with orderId '${orderId}' not found` });
      return;
    }

    Context.instance.engine.put(Api.ORDERS, orderId, order);
    const updated = Context.instance.engine.get(Api.ORDERS, orderId);
    res.status(200).json({ order: updated });
  } catch (error) {
    console.error("Error in updateOrder:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.orderId as string | undefined;

    if (!orderId) {
      res.status(400).json({ error: "orderId path parameter is required" });
      return;
    }

    const existing = Context.instance.engine.get(Api.ORDERS, orderId);
    if (!existing) {
      res.status(404).json({ error: `Order with orderId '${orderId}' not found` });
      return;
    }

    await Context.instance.engine.remove(Api.ORDERS, orderId);
    res.status(200).json({ message: `Order '${orderId}' deleted successfully` });
  } catch (error) {
    console.error("Error in deleteOrder:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
