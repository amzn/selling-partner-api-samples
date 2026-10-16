import { describe, it, expect } from "vitest";
import {
  ExecuteApiTool,
  encodePathParameter,
} from "../../src/tools/execute-api-tool.js";
import { CatalogMapper } from "../../src/catalog/swagger/catalog-mapper.js";
import type { ApiEndpoint } from "../../src/types/api-catalog.js";

describe("encodePathParameter", () => {
  it("keeps slashes in a greedy value", () => {
    expect(encodePathParameter("aplus/2020-11-01/contentDocuments", true)).toBe(
      "aplus/2020-11-01/contentDocuments",
    );
  });

  it("drops leading slashes from a greedy value", () => {
    expect(
      encodePathParameter(
        "/messaging/v1/orders/123-1234567-1234567/messages/legalDisclosure",
        true,
      ),
    ).toBe("messaging/v1/orders/123-1234567-1234567/messages/legalDisclosure");
  });

  it("still encodes reserved characters inside greedy segments", () => {
    expect(encodePathParameter("a b/c?d", true)).toBe("a%20b/c%3Fd");
  });

  it("encodes slashes in a non-greedy value", () => {
    expect(encodePathParameter("ABC/123")).toBe("ABC%2F123");
    expect(encodePathParameter("ABC/123", false)).toBe("ABC%2F123");
  });

  it("leaves plain non-greedy values unchanged", () => {
    expect(encodePathParameter("123-1234567-1234567")).toBe(
      "123-1234567-1234567",
    );
  });
});

describe("ExecuteApiTool buildUrl", () => {
  const authenticator = { getExplicitBaseUrl: () => undefined } as any;
  const tool = new ExecuteApiTool(
    { categories: [], intentMappings: [] },
    authenticator,
  );
  const buildUrl = (endpoint: ApiEndpoint, params: Record<string, any>) =>
    (tool as any).buildUrl(endpoint, params, "NA");

  const endpoint = (path: string, parameters: any[]): ApiEndpoint =>
    ({
      id: "test",
      path,
      method: "POST",
      parameters,
    }) as unknown as ApiEndpoint;

  it("builds the Uploads URL with literal slashes in resource", () => {
    const url = buildUrl(
      endpoint("/uploads/2020-11-01/uploadDestinations/{resource}", [
        { name: "resource", location: "path", greedy: true },
        { name: "marketplaceIds", location: "query" },
        { name: "contentMD5", location: "query" },
        { name: "contentType", location: "query" },
      ]),
      {
        resource: "aplus/2020-11-01/contentDocuments",
        marketplaceIds: ["ATVPDKIKX0DER"],
        contentMD5: "BQJfM1gTes+SDzArwcrpQA==",
        contentType: "image/jpeg",
      },
    );

    expect(url).toBe(
      "https://sellingpartnerapi-na.amazon.com/uploads/2020-11-01/uploadDestinations/aplus/2020-11-01/contentDocuments" +
        "?marketplaceIds=ATVPDKIKX0DER&contentMD5=BQJfM1gTes%2BSDzArwcrpQA%3D%3D&contentType=image%2Fjpeg",
    );
  });

  it("keeps encoding slashes in non-greedy path parameters", () => {
    const url = buildUrl(
      endpoint("/listings/2021-08-01/items/{sellerId}/{sku}", [
        { name: "sellerId", location: "path" },
        { name: "sku", location: "path" },
      ]),
      { sellerId: "A1B2C3", sku: "ABC/123" },
    );

    expect(url).toBe(
      "https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/A1B2C3/ABC%2F123",
    );
  });
});

describe("CatalogMapper greedy flag", () => {
  const mapParameters = (parameters: any[]) =>
    (new CatalogMapper() as any).mapParameters({ parameters }, {});

  it("marks parameters with x-amazon-spds-greedy-path-parameter as greedy", () => {
    const [param] = mapParameters([
      {
        name: "resource",
        in: "path",
        required: true,
        type: "string",
        "x-amazon-spds-greedy-path-parameter": true,
      },
    ]);
    expect(param.greedy).toBe(true);
  });

  it("leaves other parameters non-greedy", () => {
    const [param] = mapParameters([
      { name: "orderId", in: "path", required: true, type: "string" },
    ]);
    expect(param.greedy).toBe(false);
  });
});
