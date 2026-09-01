import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";

// Mock find and put functions — tests set the return value via mockFind/mockPut
const mockFind = vi.fn<() => Record<string, unknown>[]>().mockReturnValue([]);
const mockPut = vi.fn();

/** Creates a minimal Express-like request mock with a `get` method. */
function mockRequest(headers: Record<string, string> = {}): Request {
  return { get: (name: string) => headers[name.toLowerCase()] } as unknown as Request;
}

// Mock the Context singleton so engine.find/put returns our controlled data
vi.mock("../../src/database/Context.js", () => ({
  Api: { EXT_FULFILLMENT_SHIPMENTS: "extFulfillmentShipments" },
  Context: {
    get instance() {
      return {
        engine: {
          find: mockFind,
          put: mockPut,
        },
      };
    },
  },
}));

import {
  getShipmentHandler,
  processShipmentHandler,
  retrieveShippingOptionsHandler,
  generateInvoiceHandler,
  retrieveInvoiceHandler,
  generateShipLabelsHandler,
} from "../../src/operation/extFulfillmentShipmentsOperations.js";

/**
 * Creates a minimal valid UnifiedValidationPass object for testing.
 */
function makeValidationResult(overrides: Partial<UnifiedValidationPass> = {}): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "testOp",
    apiName: "External Fulfillment Shipments",
    apiVersion: "2024-09-11",
    pathParams: {},
    queryParams: {},
    body: undefined,
    resolvedEntities: {},
    operation: {},
    ...overrides,
  };
}

describe("retrieveShippingOptionsHandler", () => {
  beforeEach(() => {
    mockFind.mockReturnValue([]);
    mockPut.mockClear();
  });

  it("returns shipping option with deterministic ID for MARKETPLACE type", async () => {
    const entity = {
      id: "ship-1",
      _key: "ship-1",
      shippingInfo: { shippingType: "MARKETPLACE" },
    };

    const result = await retrieveShippingOptionsHandler(
      makeValidationResult({
        pathParams: { shipmentId: "ship-1", packageId: "pkg-1" },
        resolvedEntities: { shipment: entity },
      }),
      {} as any,
    );

    expect(result.statusCode).toBe(200);
    const body = result.data.body as any;
    expect(body.shippingOptions).toHaveLength(1);
    expect(body.shippingOptions[0].shippingOptionId).toBe("so-ship-1-pkg-1");
    expect(body.shippingOptions[0].carrierName).toBe("ATS");
  });

  it("includes recommendedShippingOption for MARKETPLACE", async () => {
    const entity = {
      id: "ship-1",
      _key: "ship-1",
      shippingInfo: { shippingType: "MARKETPLACE" },
    };

    const result = await retrieveShippingOptionsHandler(
      makeValidationResult({
        pathParams: { shipmentId: "ship-1", packageId: "pkg-1" },
        resolvedEntities: { shipment: entity },
      }),
      {} as any,
    );

    const body = result.data.body as any;
    expect(body.recommendedShippingOption).toBeDefined();
    expect(body.recommendedShippingOption.shippingOptionId).toBe("so-ship-1-pkg-1");
    expect(body.recommendedShippingOption).toEqual(body.shippingOptions[0]);
  });

  it("returns empty shippingOptions for non-MARKETPLACE type", async () => {
    const entity = {
      id: "ship-1",
      _key: "ship-1",
      shippingInfo: { shippingType: "SELF_SHIP" },
    };

    const result = await retrieveShippingOptionsHandler(
      makeValidationResult({
        pathParams: { shipmentId: "ship-1", packageId: "pkg-1" },
        resolvedEntities: { shipment: entity },
      }),
      {} as any,
    );

    expect(result.statusCode).toBe(200);
    const body = result.data.body as any;
    expect(body.shippingOptions).toEqual([]);
  });

  it("does not include recommendedShippingOption for non-MARKETPLACE", async () => {
    const entity = {
      id: "ship-1",
      _key: "ship-1",
      shippingInfo: { shippingType: "SELF_SHIP" },
    };

    const result = await retrieveShippingOptionsHandler(
      makeValidationResult({
        pathParams: { shipmentId: "ship-1", packageId: "pkg-1" },
        resolvedEntities: { shipment: entity },
      }),
      {} as any,
    );

    const body = result.data.body as any;
    expect(body.recommendedShippingOption).toBeUndefined();
  });
});

describe("generateInvoiceHandler", () => {
  beforeEach(() => {
    mockFind.mockReturnValue([]);
    mockPut.mockClear();
  });

  it("returns correct document format and content", async () => {
    const entity = { id: "ship-1", _key: "ship-1", status: "CONFIRMED" };

    const result = await generateInvoiceHandler(
      makeValidationResult({
        resolvedEntities: { shipment: entity },
      }),
      mockRequest({ host: "localhost:9001" }),
    );

    expect(result.statusCode).toBe(200);
    const body = result.data.body as any;
    expect(body.document).toEqual({ format: "PDF", content: "http://localhost:9001/invoice.pdf" });
  });

  it("sets shipmentRequirements.invoice.status to AVAILABLE", async () => {
    const entity: Record<string, unknown> = { id: "ship-1", _key: "ship-1", status: "CONFIRMED" };

    await generateInvoiceHandler(
      makeValidationResult({
        resolvedEntities: { shipment: entity },
      }),
      mockRequest({ host: "localhost:9001" }),
    );

    const requirements = entity.shipmentRequirements as any;
    expect(requirements.invoice.status).toBe("AVAILABLE");
  });

  it("creates intermediate objects when shipmentRequirements is absent", async () => {
    const entity: Record<string, unknown> = { id: "ship-1", _key: "ship-1", status: "CONFIRMED" };
    // Ensure shipmentRequirements is not present
    expect(entity.shipmentRequirements).toBeUndefined();

    await generateInvoiceHandler(
      makeValidationResult({
        resolvedEntities: { shipment: entity },
      }),
      mockRequest({ host: "localhost:9001" }),
    );

    // Intermediate objects should be created
    expect(entity.shipmentRequirements).toBeDefined();
    const requirements = entity.shipmentRequirements as any;
    expect(requirements.invoice).toBeDefined();
    expect(requirements.invoice.status).toBe("AVAILABLE");
  });

  it("calls put to persist changes", async () => {
    const entity = { id: "ship-1", _key: "ship-1", status: "CONFIRMED" };

    await generateInvoiceHandler(
      makeValidationResult({
        resolvedEntities: { shipment: entity },
      }),
      mockRequest({ host: "localhost:9001" }),
    );

    expect(mockPut).toHaveBeenCalledWith("extFulfillmentShipments", "ship-1", expect.objectContaining({ id: "ship-1" }));
  });

  it("returns 500 when resolvedEntities is undefined", async () => {
    const result = await generateInvoiceHandler(
      makeValidationResult({
        resolvedEntities: {},
      }),
      mockRequest(),
    );

    expect(result.statusCode).toBe(500);
    const body = result.data.body as any;
    expect(body.errors[0].code).toBe("InternalError");
  });
});

describe("retrieveInvoiceHandler", () => {
  beforeEach(() => {
    mockFind.mockReturnValue([]);
    mockPut.mockClear();
  });

  it("returns same document format and content", async () => {
    const entity = { id: "ship-1", _key: "ship-1", status: "CONFIRMED" };

    const result = await retrieveInvoiceHandler(
      makeValidationResult({
        resolvedEntities: { shipment: entity },
      }),
      mockRequest({ host: "localhost:9001" }),
    );

    expect(result.statusCode).toBe(200);
    const body = result.data.body as any;
    expect(body.document).toEqual({ format: "PDF", content: "http://localhost:9001/invoice.pdf" });
  });

  it("does not call put (no DB write)", async () => {
    const entity = { id: "ship-1", _key: "ship-1", status: "CONFIRMED" };

    await retrieveInvoiceHandler(
      makeValidationResult({
        resolvedEntities: { shipment: entity },
      }),
      mockRequest({ host: "localhost:9001" }),
    );

    expect(mockPut).not.toHaveBeenCalled();
  });

  it("returns 500 when resolvedEntities is undefined", async () => {
    const result = await retrieveInvoiceHandler(
      makeValidationResult({
        resolvedEntities: {},
      }),
      mockRequest(),
    );

    expect(result.statusCode).toBe(500);
    const body = result.data.body as any;
    expect(body.errors[0].code).toBe("InternalError");
  });
});

describe("generateShipLabelsHandler", () => {
  beforeEach(() => {
    mockFind.mockReturnValue([]);
    mockPut.mockClear();
  });

  it("generates label entry for each packageId", async () => {
    const entity = {
      id: "ship-1",
      _key: "ship-1",
      status: "CONFIRMED",
      packages: [{ id: "pkg-1" }, { id: "pkg-2" }],
    };

    const result = await generateShipLabelsHandler(
      makeValidationResult({
        resolvedEntities: { shipment: entity },
        body: { packageIds: ["pkg-1", "pkg-2"], courierSupportedAttributes: { carrierName: "UPS", trackingId: "TRACK123" } },
      }),
      mockRequest({ host: "localhost:9001" }),
    );

    expect(result.statusCode).toBe(200);
    const body = result.data.body as any;
    expect(body.packageShipLabelList).toHaveLength(2);
    expect(body.packageShipLabelList[0].packageId).toBe("pkg-1");
    expect(body.packageShipLabelList[1].packageId).toBe("pkg-2");
    expect(body.packageShipLabelList[0].fileData).toEqual({ url: "http://localhost:9001/label.png" });
    expect(body.packageShipLabelList[0].status).toBe("SUCCESS");
    expect(body.packageShipLabelList[1].status).toBe("SUCCESS");
  });

  it("uses carrierName and trackingId from courierSupportedAttributes", async () => {
    const entity = { id: "ship-1", _key: "ship-1", status: "CONFIRMED", packages: [{ id: "pkg-1" }] };

    const result = await generateShipLabelsHandler(
      makeValidationResult({
        resolvedEntities: { shipment: entity },
        body: { packageIds: ["pkg-1"], courierSupportedAttributes: { carrierName: "UPS", trackingId: "TRACK123" } },
      }),
      mockRequest({ host: "localhost:9001" }),
    );

    const body = result.data.body as any;
    expect(body.packageShipLabelList[0].shipLabelMetadata).toEqual({ carrierName: "UPS", trackingId: "TRACK123" });
  });

  it("defaults to empty strings when courierSupportedAttributes is absent", async () => {
    const entity = { id: "ship-1", _key: "ship-1", status: "CONFIRMED", packages: [{ id: "pkg-1" }] };

    const result = await generateShipLabelsHandler(
      makeValidationResult({
        resolvedEntities: { shipment: entity },
        body: { packageIds: ["pkg-1"] },
      }),
      mockRequest({ host: "localhost:9001" }),
    );

    const body = result.data.body as any;
    expect(body.packageShipLabelList[0].shipLabelMetadata).toEqual({ carrierName: "", trackingId: "" });
  });

  it("sets status to SHIPLABEL_GENERATED", async () => {
    const entity: Record<string, unknown> = { id: "ship-1", _key: "ship-1", status: "CONFIRMED", packages: [{ id: "pkg-1" }] };

    await generateShipLabelsHandler(
      makeValidationResult({
        resolvedEntities: { shipment: entity },
        body: { packageIds: ["pkg-1"], courierSupportedAttributes: { carrierName: "UPS", trackingId: "TRACK123" } },
      }),
      mockRequest({ host: "localhost:9001" }),
    );

    expect(entity.status).toBe("SHIPLABEL_GENERATED");
    expect(mockPut).toHaveBeenCalled();
  });

  it("non-matching packageIds still get SUCCESS entries", async () => {
    const entity = { id: "ship-1", _key: "ship-1", status: "CONFIRMED", packages: [{ id: "pkg-1" }] };

    const result = await generateShipLabelsHandler(
      makeValidationResult({
        resolvedEntities: { shipment: entity },
        body: { packageIds: ["pkg-1", "pkg-nonexistent"], courierSupportedAttributes: { carrierName: "DHL", trackingId: "T999" } },
      }),
      mockRequest({ host: "localhost:9001" }),
    );

    const body = result.data.body as any;
    expect(body.packageShipLabelList).toHaveLength(2);
    expect(body.packageShipLabelList[1].packageId).toBe("pkg-nonexistent");
    expect(body.packageShipLabelList[1].status).toBe("SUCCESS");
  });
});

/**
 * Creates a minimal valid UnifiedValidationPass for entity-based handler tests.
 */
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

describe("getShipmentHandler", () => {
  beforeEach(() => {
    mockFind.mockReturnValue([]);
    mockPut.mockReset();
  });

  it("returns entity without _key field", async () => {
    const shipment = {
      _key: "ship-001",
      id: "ship-001",
      status: "CREATED",
      locationId: "LOC-1",
      lineItems: [],
      lastUpdatedDateTime: "2024-06-15T10:00:00Z",
    };

    const validationResult = makeEntityValidationResult("getShipment", { shipment }, {}, undefined, { shipmentId: "ship-001" });

    const result = await getShipmentHandler(validationResult, {} as any);

    expect(result.statusCode).toBe(200);
    expect(result.data.body).not.toHaveProperty("_key");
    expect(result.data.body).toEqual({
      id: "ship-001",
      status: "CREATED",
      locationId: "LOC-1",
      lineItems: [],
      lastUpdatedDateTime: "2024-06-15T10:00:00Z",
    });
  });

  it("returns 500 InternalError when resolvedEntities is undefined", async () => {
    const validationResult = makeEntityValidationResult("getShipment", {}, {}, undefined, { shipmentId: "ship-001" });

    const result = await getShipmentHandler(validationResult, {} as any);

    expect(result.statusCode).toBe(500);
    const body = result.data.body as { errors: Array<{ code: string; message: string }> };
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].code).toBe("InternalError");
    expect(body.errors[0].message).toContain("shipment");
  });
});

describe("processShipmentHandler", () => {
  beforeEach(() => {
    mockFind.mockReturnValue([]);
    mockPut.mockReset();
  });

  it("CONFIRM sets status to CONFIRMED and returns 204", async () => {
    const shipment = {
      _key: "ship-001",
      id: "ship-001",
      status: "CREATED",
      lineItems: [],
      lastUpdatedDateTime: "2024-06-15T10:00:00Z",
    };

    const validationResult = makeEntityValidationResult("processShipment", { shipment }, { operation: "CONFIRM" }, undefined, {
      shipmentId: "ship-001",
    });

    const result = await processShipmentHandler(validationResult, {} as any);

    expect(result.statusCode).toBe(204);
    expect(shipment.status).toBe("CONFIRMED");
    expect(mockPut).toHaveBeenCalledWith("extFulfillmentShipments", "ship-001", shipment);
  });

  it("REJECT sets status to CANCELLED and returns 204", async () => {
    const shipment = {
      _key: "ship-002",
      id: "ship-002",
      status: "CREATED",
      lineItems: [{ id: "li-1", quantity: 2 }],
      lastUpdatedDateTime: "2024-06-15T10:00:00Z",
    };

    const validationResult = makeEntityValidationResult("processShipment", { shipment }, { operation: "REJECT" }, undefined, {
      shipmentId: "ship-002",
    });

    const result = await processShipmentHandler(validationResult, {} as any);

    expect(result.statusCode).toBe(204);
    expect(shipment.status).toBe("CANCELLED");
    expect(mockPut).toHaveBeenCalledWith("extFulfillmentShipments", "ship-002", shipment);
  });

  it("REJECT appends cancellation to matching lineItems", async () => {
    const shipment = {
      _key: "ship-003",
      id: "ship-003",
      status: "CREATED",
      lineItems: [
        { id: "li-1", quantity: 5, cancellations: [] },
        { id: "li-2", quantity: 3, cancellations: [] },
      ],
      lastUpdatedDateTime: "2024-06-15T10:00:00Z",
    };

    const body = {
      lineItems: [{ lineItem: { id: "li-1", quantity: 2 }, reason: "OUT_OF_STOCK" }],
    };

    const validationResult = makeEntityValidationResult("processShipment", { shipment }, { operation: "REJECT" }, body, {
      shipmentId: "ship-003",
    });

    const result = await processShipmentHandler(validationResult, {} as any);

    expect(result.statusCode).toBe(204);
    expect(shipment.status).toBe("CANCELLED");

    const li1 = shipment.lineItems[0] as Record<string, unknown>;
    const cancellations = li1.cancellations as Array<Record<string, unknown>>;
    expect(cancellations).toHaveLength(1);
    expect(cancellations[0].reason).toBe("OUT_OF_STOCK");
    expect(cancellations[0].cancelledQuantity).toBe(2);
    expect(cancellations[0]).toHaveProperty("cancelledAt");

    // li-2 should not have cancellations added
    const li2 = shipment.lineItems[1] as Record<string, unknown>;
    expect((li2.cancellations as unknown[]).length).toBe(0);
  });

  it("REJECT skips non-matching lineItem IDs silently", async () => {
    const shipment = {
      _key: "ship-004",
      id: "ship-004",
      status: "CREATED",
      lineItems: [{ id: "li-1", quantity: 5, cancellations: [] }],
      lastUpdatedDateTime: "2024-06-15T10:00:00Z",
    };

    const body = {
      lineItems: [{ lineItem: { id: "non-existent-id", quantity: 1 }, reason: "CUSTOMER_REQUESTED" }],
    };

    const validationResult = makeEntityValidationResult("processShipment", { shipment }, { operation: "REJECT" }, body, {
      shipmentId: "ship-004",
    });

    const result = await processShipmentHandler(validationResult, {} as any);

    expect(result.statusCode).toBe(204);
    expect(shipment.status).toBe("CANCELLED");

    // li-1 should have no cancellations since the body referenced a non-matching ID
    const li1 = shipment.lineItems[0] as Record<string, unknown>;
    expect((li1.cancellations as unknown[]).length).toBe(0);
  });

  it("returns 500 InternalError when resolvedEntities is undefined", async () => {
    const validationResult = makeEntityValidationResult("processShipment", {}, { operation: "CONFIRM" }, undefined, {
      shipmentId: "ship-001",
    });

    const result = await processShipmentHandler(validationResult, {} as any);

    expect(result.statusCode).toBe(500);
    const body = result.data.body as { errors: Array<{ code: string; message: string }> };
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].code).toBe("InternalError");
    expect(body.errors[0].message).toContain("shipment");
  });
});
