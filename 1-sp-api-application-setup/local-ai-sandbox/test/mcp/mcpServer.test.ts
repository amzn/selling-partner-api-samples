import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { localhostHostValidation } from "@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js";
import { Api, Context } from "../../src/database/Context.js";
import { listingKey } from "../../src/operation/listingsItemModel.js";
import { createMcpServer, mcpRouter } from "../../src/mcp/mcpServer.js";
import { SCENARIO_SELLER_ID } from "../../src/controller/scenariosController.js";

function firstText(result: unknown): string {
  const content = (result as { content: { type: string; text: string }[] }).content;
  return content[0].text;
}

describe("MCP server", () => {
  let client: Client;

  beforeEach(async () => {
    Context.reset();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await createMcpServer().connect(serverTransport);
    client = new Client({ name: "test", version: "1.0.0" });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
  });

  it("exposes the generation tools and prompt", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        "clear_data",
        "get_api_model",
        "get_data",
        "get_generation_guidance",
        "get_sandbox_context",
        "get_scenario",
        "insert_entities",
        "list_apis",
        "list_scenarios",
        "seed_scenario",
      ].sort(),
    );
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(["generate_test_data"]);

    const prompt = await client.getPrompt({ name: "generate_test_data", arguments: { request: "two unshipped orders" } });
    expect(JSON.stringify(prompt.messages)).toContain("two unshipped orders");
  });

  it("list_scenarios indexes without inlining step detail", async () => {
    const body = JSON.parse(firstText(await client.callTool({ name: "list_scenarios", arguments: {} }))) as {
      id: string;
      tracks: { id: string; stepCount: number; steps?: unknown }[];
    }[];

    expect(body.length).toBeGreaterThan(0);
    for (const scenario of body) {
      for (const track of scenario.tracks) {
        expect(track.stepCount).toBeGreaterThan(0);
        // The index must stay cheap: steps belong to get_scenario.
        expect(track.steps).toBeUndefined();
      }
    }
  });

  it("get_scenario returns the full steps and rejects an unknown id", async () => {
    const body = JSON.parse(firstText(await client.callTool({ name: "get_scenario", arguments: { scenarioId: "launch-a-product" } }))) as {
      id: string;
      tracks: { steps: { method: string; path: string; status: string }[] }[];
    };
    expect(body.id).toBe("launch-a-product");
    expect(body.tracks[0].steps.length).toBeGreaterThan(0);
    expect(body.tracks[0].steps[0].method).toBeTruthy();

    const missing = await client.callTool({ name: "get_scenario", arguments: { scenarioId: "nope" } });
    expect(missing.isError).toBe(true);
  });

  it("get_sandbox_context reports the base URL and scenario seller", async () => {
    const body = JSON.parse(firstText(await client.callTool({ name: "get_sandbox_context", arguments: {} }))) as {
      baseUrl: string;
      mode: string;
      scenarioSellerId: string;
      marketplaceId: string;
    };
    expect(body.baseUrl).toMatch(/^http:\/\/localhost:\d+$/);
    expect(body.mode).toBe("Seller");
    expect(body.scenarioSellerId).toBe(SCENARIO_SELLER_ID);
    expect(body.marketplaceId).toBeTruthy();
  });

  it("scenario step paths carry no unsubstituted placeholders", async () => {
    const body = JSON.parse(firstText(await client.callTool({ name: "get_scenario", arguments: { scenarioId: "launch-a-product" } }))) as {
      tracks: { steps: { path: string }[] }[];
    };

    // An agent sends these paths as given, so a leftover placeholder or the old
    // YOUR_SELLER_ID literal would become a failed request it cannot diagnose.
    for (const track of body.tracks) {
      for (const step of track.steps) {
        expect(step.path).not.toContain("{{");
        expect(step.path).not.toContain("YOUR_SELLER_ID");
      }
    }
  });

  it("list_apis reports every namespace", async () => {
    const body = JSON.parse(firstText(await client.callTool({ name: "list_apis", arguments: {} }))) as { apis: string[]; mode: string };
    expect(body.apis.sort()).toEqual(Object.values(Api).sort());
    expect(body.mode).toBe("Seller");
  });

  it("get_generation_guidance falls back to a no-guidance note", async () => {
    const text = firstText(await client.callTool({ name: "get_generation_guidance", arguments: { api: Api.ORDERS } }));
    expect(text).toContain("No sandbox-specific guidance");
  });

  it("insert_entities writes valid items and reports per-item failures", async () => {
    const result = await client.callTool({
      name: "insert_entities",
      arguments: {
        items: [
          { api: Api.ORDERS, id: "111-1", entity: { orderId: "111-1" } },
          { api: Api.LISTINGS, id: "SKU-1", entity: { sku: "SKU-1" } },
          { api: Api.LISTINGS, id: "SKU-2", entity: { sellerId: "S1", sku: "SKU-2" } },
        ],
      },
    });
    const body = JSON.parse(firstText(result)) as { inserted: number; failed: number; results: { ok: boolean }[] };
    expect(body.inserted).toBe(2);
    expect(body.failed).toBe(1);
    expect(body.results.map((r) => r.ok)).toEqual([true, false, true]);

    const data = JSON.parse(firstText(await client.callTool({ name: "get_data", arguments: { api: Api.LISTINGS } }))) as Record<
      string,
      Record<string, unknown>
    >;
    expect(Object.keys(data[Api.LISTINGS])).toEqual([listingKey("S1", "SKU-2")]);
    expect(Context.instance.engine.get(Api.ORDERS, "111-1")).toMatchObject({ orderId: "111-1" });
  });

  it("rejects an unknown api namespace", async () => {
    const result = await client.callTool({ name: "insert_entities", arguments: { items: [{ api: "nope", id: "1", entity: {} }] } });
    expect(result.isError).toBe(true);
  });

  it("seeds a scenario and clears data", async () => {
    const scenarios = JSON.parse(firstText(await client.callTool({ name: "list_scenarios", arguments: {} }))) as { id: string }[];
    expect(scenarios.length).toBeGreaterThan(0);

    const seeded = await client.callTool({ name: "seed_scenario", arguments: { scenarioId: scenarios[0].id } });
    expect(seeded.isError).toBeFalsy();
    expect((JSON.parse(firstText(seeded)) as { seedCount: number }).seedCount).toBeGreaterThan(0);

    const missing = await client.callTool({ name: "seed_scenario", arguments: { scenarioId: "does-not-exist" } });
    expect(missing.isError).toBe(true);

    await client.callTool({ name: "clear_data", arguments: {} });
    const data = JSON.parse(firstText(await client.callTool({ name: "get_data", arguments: {} }))) as Record<string, Record<string, unknown>>;
    expect(Object.values(data).every((docs) => Object.keys(docs).length === 0)).toBe(true);
  });
});

describe("MCP HTTP endpoint", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    Context.reset();
    const app = express();
    app.use(express.json());
    app.use("/mcp", localhostHostValidation(), mcpRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        resolve();
      });
    });
    baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/mcp`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  const initialize = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
  };
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };

  it("serves MCP over POST for a localhost Host header", async () => {
    const response = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify(initialize) });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("sp-api-sandbox");
  });

  it("rejects a non-localhost Host header (DNS rebinding)", async () => {
    // fetch forbids overriding Host, so use node:http directly.
    const { request } = await import("node:http");
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(baseUrl, { method: "POST", headers: { ...headers, host: "evil.example.com" } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on("error", reject);
      req.end(JSON.stringify(initialize));
    });
    expect(status).toBe(403);
  });

  it("returns 405 for GET", async () => {
    const response = await fetch(baseUrl, { method: "GET", headers });
    expect(response.status).toBe(405);
  });
});
