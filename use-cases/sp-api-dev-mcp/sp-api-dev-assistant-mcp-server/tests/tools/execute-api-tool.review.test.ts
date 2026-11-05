import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("axios", () => ({ default: vi.fn() }));

import axios from "axios";
import { ExecuteApiTool } from "../../src/tools/execute-api-tool.js";
import { ExploreCatalogTool } from "../../src/tools/explore-catalog-tool.js";
import { CatalogMapper } from "../../src/catalog/swagger/catalog-mapper.js";
import type {
  ApiCatalog,
  ApiEndpoint,
  ApiParameter,
} from "../../src/types/api-catalog.js";

const pathParam = (name: string): ApiParameter => ({
  name,
  location: "path",
  required: true,
  type: "string",
  description: "",
  purpose: "",
});

const endpoint = (
  id: string,
  version: string,
  method: string,
  path: string,
  extra: Partial<ApiEndpoint> = {},
): ApiEndpoint => ({
  id,
  originalOperationId: id.split("_").pop()!,
  name: id,
  path,
  method,
  description: "",
  purpose: "",
  commonUseCases: [],
  parameters: [],
  responses: [],
  relatedEndpoints: [],
  version: { current: version, deprecated: [], beta: [], changes: [] },
  examples: [],
  ...extra,
});

// The three collisions in the real models: the finances Invoices API and
// the tax Invoices API (titles differ by a trailing period) both produce
// invoices_getInvoice; Shipping v2 defines linkCarrierAccount as PUT and
// POST; Orders v0 getOrder is deprecated and Orders 2026-01-01 replaces it.
const catalog: ApiCatalog = {
  categories: [
    {
      name: "Amazon Shipping API",
      description: "",
      endpoints: [
        endpoint(
          "amazonShippingApi_linkCarrierAccount",
          "v2",
          "POST",
          "/shipping/v2/carrierAccounts/{carrierId}",
        ),
        endpoint(
          "amazonShippingApi_linkCarrierAccount",
          "v2",
          "PUT",
          "/shipping/v2/carrierAccounts/{carrierId}",
        ),
      ],
    },
    {
      name: "Invoices",
      description: "",
      endpoints: [
        endpoint(
          "invoices_getInvoice",
          "2026-06-25",
          "GET",
          "/finances/invoices/2026-06-25/invoices/{invoiceIdentifier}",
          { parameters: [pathParam("invoiceIdentifier")] },
        ),
      ],
    },
    {
      name: "Invoices.",
      description: "",
      endpoints: [
        endpoint(
          "invoices_getInvoice",
          "2024-06-19",
          "GET",
          "/tax/invoices/2024-06-19/invoices/{invoiceId}",
          { parameters: [pathParam("invoiceId")] },
        ),
      ],
    },
    {
      name: "Orders",
      description: "",
      endpoints: [
        endpoint(
          "orders_getOrder",
          "v0",
          "GET",
          "/orders/v0/orders/{orderId}",
          {
            deprecated: true,
          },
        ),
        endpoint(
          "orders_getOrder",
          "2026-01-01",
          "GET",
          "/orders/2026-01-01/orders/{orderId}",
        ),
      ],
    },
  ],
  intentMappings: [],
};

const authenticator = {
  getExplicitBaseUrl: () => undefined,
  signRequest: async (request: any) => request,
} as any;
const tool = new ExecuteApiTool(catalog, authenticator);
const explorer = new ExploreCatalogTool(catalog);
const respond = (status: number) =>
  vi.mocked(axios).mockResolvedValue({
    status,
    statusText: "",
    headers: {},
    data: {},
  } as any);
const sent = () => vi.mocked(axios).mock.calls[0][0] as any;

beforeEach(() => vi.mocked(axios).mockReset());

describe("two APIs sharing an ID prefix", () => {
  it("lists each category with an ID that calls its own API", async () => {
    const tax = await explorer.execute({ category: "Invoices." } as any);
    expect(tax).toContain("`invoices_2024-06-19_getInvoice`");
    expect(tax).not.toContain("`invoices_getInvoice`");

    respond(200);
    await tool.execute({
      endpoint: "invoices_2024-06-19_getInvoice",
      parameters: { invoiceId: "INV-1" },
      region: "NA",
    } as any);
    expect(sent().url).toContain("/tax/invoices/2024-06-19/invoices/INV-1");
  });

  it("does not describe the other API as another version", async () => {
    respond(400);
    const result = await tool.execute({
      endpoint: "invoices_getInvoice",
      parameters: { invoiceIdentifier: "X" },
      region: "NA",
    } as any);
    expect(result).not.toContain("Other Versions");
    expect(result).not.toContain("2024-06-19");
  });
});

describe("one operationId with two HTTP methods", () => {
  it("shows each with a method suffix", async () => {
    const list = await explorer.execute({ listEndpoints: true } as any);
    expect(list).toContain("`amazonShippingApi_v2_linkCarrierAccount_POST`");
    expect(list).toContain("`amazonShippingApi_v2_linkCarrierAccount_PUT`");
  });

  it("reaches the PUT by method, by suffix, or defaults to POST", async () => {
    for (const call of [
      { endpoint: "amazonShippingApi_linkCarrierAccount", method: "PUT" },
      { endpoint: "amazonShippingApi_v2_linkCarrierAccount_PUT" },
      { endpoint: "linkCarrierAccount", method: "PUT" },
    ]) {
      vi.mocked(axios).mockReset();
      respond(200);
      await tool.execute({
        ...call,
        parameters: { carrierId: "C1" },
        region: "NA",
      } as any);
      expect(sent().method).toBe("PUT");
    }

    vi.mocked(axios).mockReset();
    respond(200);
    await tool.execute({
      endpoint: "amazonShippingApi_linkCarrierAccount",
      parameters: { carrierId: "C1" },
      region: "NA",
    } as any);
    expect(sent().method).toBe("POST");

    const rejected = await tool.execute({
      endpoint: "amazonShippingApi_linkCarrierAccount",
      parameters: { carrierId: "C1" },
      method: "DELETE",
    } as any);
    expect(rejected).toContain("Method 'DELETE' does not match");

    // A suffix means nothing on an operation that has no twin
    const noTwin = await tool.execute({
      endpoint: "orders_getOrder_GET",
      parameters: { orderId: "1" },
    } as any);
    expect(noTwin).toContain("not found");
  });
});

describe("deprecated operations", () => {
  it("copies the spec's deprecated flag", () => {
    const swagger = {
      swagger: "2.0",
      info: { title: "Selling Partner API for Orders", version: "v0" },
      paths: {},
    };
    const mapped = (new CatalogMapper() as any).mapOperationToEndpoint(
      "/orders/v0/orders/{orderId}",
      "GET",
      { operationId: "getOrder", deprecated: true, responses: {} },
      swagger,
    ) as ApiEndpoint;
    expect(mapped.deprecated).toBe(true);
  });

  it("warns through a plain ID and names the replacement, but not on the current version", async () => {
    respond(200);
    const old = await tool.execute({
      endpoint: "orders_getOrder",
      parameters: { orderId: "1" },
      region: "NA",
    } as any);
    expect(old).toContain(
      "⚠️ `orders_v0_getOrder` is deprecated. Use `orders_2026-01-01_getOrder`.",
    );

    vi.mocked(axios).mockReset();
    respond(200);
    const current = await tool.execute({
      endpoint: "orders_2026-01-01_getOrder",
      parameters: { orderId: "1" },
      region: "NA",
    } as any);
    expect(current).not.toContain("deprecated");

    const list = await explorer.execute({ category: "Orders" } as any);
    expect(list).toContain(
      "| `orders_v0_getOrder` | orders_getOrder (deprecated) |",
    );
  });
});
