/**
 * MCP server exposing the sandbox's data-generation primitives to MCP clients
 * such as Claude Code, so the client itself can act as the test-data generator:
 * read the API model and stored-shape guidance, insert records, read them back.
 *
 * It runs inside the sandbox's own Express process (Streamable HTTP at /mcp)
 * because the database is in-process: a separate stdio server would write to
 * its own, invisible copy of the data.
 *
 * Exposure: /mcp has no authentication and is meant for loopback use only. It
 * is mounted behind localhostHostValidation (DNS-rebinding protection), the
 * server binds 127.0.0.1 by default, and MCP_ENABLED=false removes the route.
 */
import { Router, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { Api, Context } from "../database/Context.js";
import { CURRENT_MODE } from "../registry/operationRegistry.js";
import { resolveRegion } from "../marketplaceIds.js";
import { domainsWithGuidance } from "../tool/domainGuidance.js";
import { insertEntity, noGuidanceMessage, retrieveGuidance, retrieveModel, snapshotData } from "../tool/dataGenerationCore.js";
import { seedScenarioById, summarizeScenarios } from "../controller/scenariosController.js";

export const MAX_BATCH_SIZE = 100;

const apiSchema = z.enum(Api).describe("Sandbox API namespace (see list_apis)");

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

function json(value: unknown) {
  return text(JSON.stringify(value, null, 2));
}

function errorText(value: string) {
  return { ...text(value), isError: true };
}

/** Instructions mirroring the POST /chat system prompt, adapted for an agent that can verify its work. */
export function generationInstructions(request: string): string {
  return `You are generating test data for the local Sample AI Sandbox for SP-API, using the sp-api-sandbox MCP tools.

REQUEST
${request}

PROCESS
1. Call list_apis and identify the target Api namespace(s) for the request. If the request is not a test-data request, or names an API the sandbox does not support, say so briefly and stop.
2. For each target Api, call get_api_model AND get_generation_guidance. The API model describes the API response shape, not the stored document shape: where the two differ, the guidance is authoritative. If there is no guidance, the API model shape is enough.
3. Build the records so they validate against the model and follow the guidance. The 'id' you pass must match the entity's own id field (listings derive their key from sellerId + sku; FBA inventory from sellerSku).
4. Write them with insert_entities (batch up to ${String(MAX_BATCH_SIZE)} per call). Fix and retry any item it reports as failed.
5. Verify: call the matching SP-API GET endpoint on http://localhost:9001 (or use get_data) and confirm the handlers return what you generated. Fix and re-insert anything that does not read back correctly.
6. Reply with a short summary of what was created (Api, ids) and how you verified it.`;
}

/** Builds a fresh MCP server with the sandbox tools and prompt registered. */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "sp-api-sandbox", version: "1.0.0" });

  server.registerTool(
    "list_apis",
    {
      description:
        "Lists the sandbox's API namespaces (the 'api' values the other tools accept), which of them have " +
        "stored-shape guidance, and the sandbox's operating MODE and REGION.",
      annotations: { readOnlyHint: true },
    },
    () =>
      json({
        apis: Object.values(Api),
        apisWithGuidance: domainsWithGuidance(),
        mode: CURRENT_MODE,
        region: resolveRegion(),
      }),
  );

  server.registerTool(
    "get_api_model",
    {
      description:
        "Returns the raw OpenAPI model for an Api. It describes the API response shape; check get_generation_guidance for how stored documents differ.",
      inputSchema: { api: apiSchema },
      annotations: { readOnlyHint: true },
    },
    ({ api }) => {
      const model = retrieveModel(api);
      return model ? text(model) : errorText(`No model found for '${api}'.`);
    },
  );

  server.registerTool(
    "get_generation_guidance",
    {
      description:
        "Returns sandbox-specific data-generation guidance for an Api: how the stored document shape differs from the " +
        "API model, which fields the handlers key and filter on, and system-managed fields. Authoritative where it differs from the model.",
      inputSchema: { api: apiSchema },
      annotations: { readOnlyHint: true },
    },
    ({ api }) => text(retrieveGuidance(api) ?? noGuidanceMessage(api)),
  );

  server.registerTool(
    "insert_entities",
    {
      description:
        `Inserts or replaces up to ${String(MAX_BATCH_SIZE)} generated records. Each item is {api, id, entity}; 'id' must match the ` +
        "entity's id. Listings need 'sellerId' and 'sku' in the entity (the key is derived from both); FBA inventory needs 'sellerSku'. " +
        "Writes fire the sandbox's data triggers (e.g. inventory deduction on order insert). Returns a per-item result.",
      inputSchema: {
        items: z
          .array(
            z.object({
              api: apiSchema,
              id: z.string().min(1),
              entity: z.record(z.string(), z.unknown()),
            }),
          )
          .min(1)
          .max(MAX_BATCH_SIZE),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    ({ items }) => {
      const results = items.map(({ api, id, entity }) => ({ api, id, ...insertEntity(api, id, entity) }));
      const failed = results.filter((r) => !r.ok).length;
      return json({ inserted: results.length - failed, failed, results });
    },
  );

  server.registerTool(
    "get_data",
    {
      description:
        "Returns the documents currently stored in the sandbox database, keyed by Api then storage key. Pass 'api' to restrict to one namespace.",
      inputSchema: { api: apiSchema.optional() },
      annotations: { readOnlyHint: true },
    },
    ({ api }) => json(snapshotData(api)),
  );

  server.registerTool(
    "clear_data",
    {
      description: "Deletes ALL data in the sandbox database (every Api namespace). Same as DELETE /data.",
      annotations: { destructiveHint: true },
    },
    () => {
      Context.instance.clear();
      return text("All data has been cleared.");
    },
  );

  server.registerTool(
    "list_scenarios",
    {
      description: "Lists the guided scenarios (pre-built, consistent fixture sets with runnable SP-API steps) available in the configured region.",
      annotations: { readOnlyHint: true },
    },
    () => json(summarizeScenarios()),
  );

  server.registerTool(
    "seed_scenario",
    {
      description: "Seeds a guided scenario's fixture data into the database (see list_scenarios). Does not fire data triggers.",
      inputSchema: { scenarioId: z.string().min(1) },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    ({ scenarioId }) => {
      const result = seedScenarioById(scenarioId);
      return result ? json(result) : errorText(`Scenario '${scenarioId}' not found (or not available in this region).`);
    },
  );

  server.registerPrompt(
    "generate_test_data",
    {
      description: "Generate sandbox test data from a natural-language request, then verify it reads back through the SP-API endpoints.",
      argsSchema: { request: z.string().describe("What to generate, e.g. 'three unshipped orders for one seller'") },
    },
    ({ request }) => ({
      messages: [{ role: "user", content: { type: "text", text: generationInstructions(request) } }],
    }),
  );

  return server;
}

/** Express router serving the MCP Streamable HTTP endpoint in stateless mode (one server per request). */
export const mcpRouter: Router = Router();

mcpRouter.post("/", async (request: Request, response: Response) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  response.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  } catch (error) {
    console.error("MCP request failed:", error);
    if (!response.headersSent) {
      response.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});

// Stateless mode keeps no sessions, so there is no SSE stream to open (GET) or session to end (DELETE).
mcpRouter.all("/", (_request: Request, response: Response) => {
  response
    .status(405)
    .set("Allow", "POST")
    .json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
});
