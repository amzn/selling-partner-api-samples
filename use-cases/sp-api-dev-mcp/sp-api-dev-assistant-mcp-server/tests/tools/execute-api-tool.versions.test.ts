import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtemp, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

vi.mock("axios", () => ({
  default: vi.fn().mockResolvedValue({
    status: 200,
    statusText: "OK",
    headers: {},
    data: {},
  }),
}));

import axios from "axios";
import {
  ExecuteApiTool,
  executeApiSchema,
} from "../../src/tools/execute-api-tool.js";
import { SwaggerLoader } from "../../src/catalog/swagger/swagger-loader.js";
import type { ApiCatalog, ApiEndpoint } from "../../src/types/api-catalog.js";

const endpoint = (
  id: string,
  version: string,
  method: string,
  path: string,
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
});

// Two versions sharing one ID, older loaded first (as the sorted loader does)
const catalog: ApiCatalog = {
  categories: [
    {
      name: "Catalog Items",
      description: "",
      endpoints: [
        endpoint(
          "catalogItems_getCatalogItem",
          "2020-12-01",
          "GET",
          "/catalog/2020-12-01/items",
        ),
        endpoint(
          "catalogItems_getCatalogItem",
          "2022-04-01",
          "GET",
          "/catalog/2022-04-01/items",
        ),
      ],
    },
    {
      name: "Listings Items",
      description: "",
      endpoints: [
        endpoint(
          "listingsItems_patchListingsItem",
          "2020-09-01",
          "PATCH",
          "/listings/2020-09-01/items",
        ),
        endpoint(
          "listingsItems_patchListingsItem",
          "2021-08-01",
          "PATCH",
          "/listings/2021-08-01/items",
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

describe("version-qualified endpoint IDs", () => {
  const tool = new ExecuteApiTool(catalog, authenticator);
  const find = (id: string) => (tool as any).findEndpoint(id) as ApiEndpoint;

  it("keeps resolving the plain ID to the first loaded version", () => {
    expect(find("catalogItems_getCatalogItem").version.current).toBe(
      "2020-12-01",
    );
  });

  it("resolves {api}_{version}_{operationId} to that version", () => {
    expect(find("catalogItems_2022-04-01_getCatalogItem").path).toBe(
      "/catalog/2022-04-01/items",
    );
    expect(find("catalogItems_2020-12-01_getCatalogItem").path).toBe(
      "/catalog/2020-12-01/items",
    );
    expect(find("listingsItems_2021-08-01_patchListingsItem").path).toBe(
      "/listings/2021-08-01/items",
    );
  });

  it("returns nothing for a version that does not exist", () => {
    expect(find("catalogItems_2099-01-01_getCatalogItem")).toBeUndefined();
  });
});

describe("HTTP method handling", () => {
  const tool = new ExecuteApiTool(catalog, authenticator);

  beforeEach(() => vi.mocked(axios).mockClear());

  it("accepts PATCH in the tool schema", () => {
    const parsed = executeApiSchema.parse({
      endpoint: "listingsItems_2021-08-01_patchListingsItem",
      parameters: {},
      method: "PATCH",
    });
    expect(parsed.method).toBe("PATCH");
  });

  it("sends PATCH to the requested version when the method matches", async () => {
    await tool.execute({
      endpoint: "listingsItems_2021-08-01_patchListingsItem",
      parameters: {},
      method: "PATCH",
      region: "NA",
    } as any);

    expect(axios).toHaveBeenCalledTimes(1);
    const request = vi.mocked(axios).mock.calls[0][0] as any;
    expect(request.method).toBe("PATCH");
    expect(request.url).toBe(
      "https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items",
    );
  });

  it("rejects a method that does not match the endpoint without sending a request", async () => {
    const result = await tool.execute({
      endpoint: "listingsItems_2021-08-01_patchListingsItem",
      parameters: {},
      method: "POST",
      region: "NA",
    } as any);

    expect(result).toContain("does not match");
    expect(axios).not.toHaveBeenCalled();
  });
});

describe("SwaggerLoader file order", () => {
  it("finds files in sorted order regardless of filesystem order", async () => {
    const dir = await mkdtemp(join(tmpdir(), "swagger-order-"));
    await mkdir(join(dir, "b-model"));
    await mkdir(join(dir, "a-model"));
    await writeFile(join(dir, "b-model", "api_2022-04-01.json"), "{}");
    await writeFile(join(dir, "b-model", "api_2020-12-01.json"), "{}");
    await writeFile(join(dir, "a-model", "other.json"), "{}");

    const files: string[] = await (
      new SwaggerLoader() as any
    ).findSwaggerFilesRecursively(dir);

    expect(
      files.map((f) => f.slice(dir.length + 1).replace(/\\/g, "/")),
    ).toEqual([
      "a-model/other.json",
      "b-model/api_2020-12-01.json",
      "b-model/api_2022-04-01.json",
    ]);
  });
});
