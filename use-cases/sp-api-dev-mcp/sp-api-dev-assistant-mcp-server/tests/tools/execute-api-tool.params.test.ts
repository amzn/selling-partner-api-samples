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

const query = (
  name: string,
  extra: Partial<ApiParameter> = {},
): ApiParameter => ({
  name,
  location: "query",
  required: false,
  type: "string",
  description: "",
  purpose: "",
  ...extra,
});

const endpoint = (
  id: string,
  version: string,
  method: string,
  path: string,
  parameters: ApiParameter[],
): ApiEndpoint => ({
  id,
  originalOperationId: id.split("_").pop()!,
  name: id,
  path,
  method,
  description: "",
  purpose: "",
  commonUseCases: [],
  parameters,
  responses: [],
  relatedEndpoints: [],
  version: { current: version, deprecated: [], beta: [], changes: [] },
  examples: [],
});

// Listings 2020-09-01 (no `mode`) loads first, so the plain ID resolves to it
const catalog: ApiCatalog = {
  categories: [
    {
      name: "Listings Items",
      description: "",
      endpoints: [
        endpoint(
          "listingsItems_patchListingsItem",
          "2020-09-01",
          "PATCH",
          "/listings/2020-09-01/items",
          [],
        ),
        endpoint(
          "listingsItems_patchListingsItem",
          "2021-08-01",
          "PATCH",
          "/listings/2021-08-01/items",
          [query("mode")],
        ),
      ],
    },
    {
      name: "Catalog Items",
      description: "",
      endpoints: [
        endpoint(
          "catalogItems_searchCatalogItems",
          "2022-04-01",
          "GET",
          "/catalog/2022-04-01/items",
          [
            query("includedData", { type: "array" }),
            query("mskus", { type: "array", collectionFormat: "multi" }),
          ],
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

const respond = (status: number) =>
  vi
    .mocked(axios)
    .mockResolvedValue({
      status,
      statusText: "",
      headers: {},
      data: {},
    } as any);

describe("sp_api_execute across API versions", () => {
  const tool = new ExecuteApiTool(catalog, authenticator);

  beforeEach(() => vi.mocked(axios).mockReset());

  it("rejects a parameter only another version defines instead of dropping it", async () => {
    const result = await tool.execute({
      endpoint: "listingsItems_patchListingsItem",
      parameters: { mode: "VALIDATION_PREVIEW" },
    } as any);

    expect(result).toContain("use listingsItems_2021-08-01_patchListingsItem");
    expect(axios).not.toHaveBeenCalled();
  });

  it("lists the other versions when a call fails", async () => {
    respond(400);
    const result = await tool.execute({
      endpoint: "listingsItems_patchListingsItem",
      parameters: {},
      region: "NA",
    } as any);

    expect(result).toContain("`listingsItems_2021-08-01_patchListingsItem`");
  });

  it("joins arrays with commas by default and repeats keys only for multi", async () => {
    respond(200);
    await tool.execute({
      endpoint: "catalogItems_searchCatalogItems",
      parameters: {
        includedData: ["relationships", "summaries"],
        mskus: ["A", "B"],
      },
      region: "NA",
    } as any);

    expect((vi.mocked(axios).mock.calls[0][0] as any).url).toContain(
      "includedData=relationships%2Csummaries&mskus=A&mskus=B",
    );
  });
});

describe("version support around the catalog", () => {
  it("carries collectionFormat from the spec", () => {
    const [p] = (new CatalogMapper() as any).mapParameters(
      {
        parameters: [
          {
            name: "mskus",
            in: "query",
            type: "array",
            collectionFormat: "multi",
          },
        ],
      },
      {},
    );
    expect(p.collectionFormat).toBe("multi");
  });

  it("explorer lists duplicated IDs by version and opens a versioned ID", async () => {
    const explorer = new ExploreCatalogTool(catalog);

    const list = await explorer.execute({ listEndpoints: true } as any);
    expect(list).toContain("`listingsItems_2021-08-01_patchListingsItem`");

    const details = await explorer.execute({
      endpoint: "listingsItems_2021-08-01_patchListingsItem",
    } as any);
    expect(details).toContain("/listings/2021-08-01/items");
  });
});
