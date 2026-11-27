import express, { Request, Response } from "express";
import { configureLogging } from "@strands-agents/sdk";
import { Context } from "./database/Context.js";
import { validate as validateOperationRegistry } from "./registry/operationRegistry.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { generateData } from "./controller/dataGeneratorController.js";
import { createOrder, updateOrder, deleteOrder } from "./controller/ordersManagementController.js";
import { getNotificationSchemas, sendNotification } from "./controller/notificationsManagementController.js";
import { downloadReportDocument, downloadDataKioskDocument } from "./controller/spapiController.js";
import { listScenarios, getScenario, seedScenario } from "./controller/scenariosController.js";
import { importCatalogItems, reprocessMatching } from "./controller/catalogManagementController.js";
import { startMatchingScheduler } from "./service/matchingScheduler.js";
import { assertGuidanceMatchesRegistry } from "./tool/domainGuidance.js";
import { snapshotData } from "./tool/dataGenerationCore.js";
import { mcpRouter } from "./mcp/mcpServer.js";
import { localhostHostValidation } from "@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js";

/**
 * APPLICATION SETUP
 */
const app = express();

const port = Number(process.env.PORT ?? "9001");
// Loopback by default: the sandbox has no authentication. Set HOST deliberately to widen the bind.
const host = process.env.HOST ?? "127.0.0.1";
const mcpEnabled = process.env.MCP_ENABLED !== "false";
configureLogging(console);
export const asyncLocalStorage = new AsyncLocalStorage();

/**
 * NON-SCHEMA ROUTES (download reports, data kiosk documents)
 */
app.get("/reports/download/:documentId", downloadReportDocument);
app.get("/dataKiosk/download/:documentId", downloadDataKioskDocument);

/**
 * BODY PARSER
 */
app.use(express.json());
app.use(express.static("public"));
app.use(express.static("res/response"))

/**
 * RETURN DB CONTENT
 */
app.get("/data", (request: Request, response: Response) => {
  response.status(200).json(snapshotData());
});

/**
 * CLEAR DB CONTENT
 */
app.delete("/data", (request: Request, response: Response) => {
  Context.instance.clear();
  response.status(200).json({ message: "All data has been cleared." });
});

/**
 * DATA GENERATOR
 */
app.post("/chat", generateData);

/**
 * GUIDED SCENARIOS (pre-seeded, runnable SP-API journeys)
 */
app.get("/scenarios", listScenarios);
app.get("/scenarios/:scenarioId", getScenario);
app.post("/scenarios/:scenarioId/seed", seedScenario);

/**
 * ORDERS MANAGEMENT
 */
app.post("/manage/orders", createOrder);
app.put("/manage/orders", updateOrder);
app.delete("/manage/orders/:orderId", deleteOrder);

/**
 * NOTIFICATIONS MANAGEMENT
 */
app.get("/manage/notifications/schemas", getNotificationSchemas);
app.post("/manage/notifications/send", sendNotification);

/**
 * CATALOG MANAGEMENT (seed from production, re-run matching)
 */
app.post("/manage/catalog/import", importCatalogItems);
app.post("/manage/catalog/reprocess-matching", reprocessMatching);

/**
 * MCP SERVER (Claude Code and other MCP clients; loopback only, see src/mcp/mcpServer.ts)
 * Mounted before the generic handler, which would otherwise treat /mcp as an SP-API path.
 */
if (mcpEnabled) {
  app.use("/mcp", localhostHostValidation(), mcpRouter);
}

/**
 * GENERIC REQUEST HANDLER
 */
app.all("/{*splat}", async (req, res) => {
  const { createResponse } = await import("./controller/spapiController.js");
  return createResponse(req, res);
});

/**
 * APPLICATION STARTUP
 */
console.log(`
   _______     ___   ___  ____   
  / __/ _ \\   / _ | / _ \\/  _/   
 _\\ \\/ ___/  / __ |/ ___// /     
/___/_/___  /_/_|_/_/__/___/     
/_  __/ _ | /  _/ __/_  __/      
 / / / __ |_/ /_\\ \\  / /         
/_/ /_/ |_/___/___/ /_/              
`);

validateOperationRegistry();
// Fail fast if the data-generation guidance registry has drifted from the
// operation registry (a guidance entry naming an unknown namespace).
assertGuidanceMatchesRegistry();
// Init database
void Context.instance;
// Re-evaluate catalog matching on a timer, so a catalog item that arrives
// after a listing still clears that listing's matching issue.
startMatchingScheduler();

app.listen(port, host, () => {
  console.log(`App listening on http://${host}:${String(port)}`);
  if (mcpEnabled) console.log(`MCP server available at http://localhost:${String(port)}/mcp`);
});
