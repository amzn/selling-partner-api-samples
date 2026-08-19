import express, { Request, Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { configureLogging } from "@strands-agents/sdk";
import { Context } from "./database/Context.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { generateData } from "./controller/dataGeneratorController.js";
import { trackRequest, identifyApiSection, shutdownTelemetry } from "./service/telemetryService.js";
import {
  createReport,
  getReport,
  getReports,
  cancelReport,
  getReportDocument,
  downloadReportDocument,
  createReportSchedule,
  getReportSchedule,
  getReportSchedules,
  cancelReportSchedule,
} from "./controller/reportsController.js";

/**
 * APPLICATION SETUP
 */
const app = express();

/**
 * TELEMETRY MIDDLEWARE (before all routes)
 */
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    try {
      trackRequest(identifyApiSection(req.path), Date.now() - start, res.statusCode);
    } catch {
      /* fail-safe */
    }
  });
  next();
});

const port = process.env.PORT ?? "9001";
const region = process.env.REGION && ["NA", "EU", "FE"].includes(process.env.REGION) ? process.env.REGION : "NA";
export const PROD_BACKEND = `https://sellingpartnerapi-${region.toLowerCase()}.amazon.com`;
configureLogging(console);
export const asyncLocalStorage = new AsyncLocalStorage();

/**
 * PASS-THROUGH CONFIGURATION (before body parser)
 */
const passThroughProxy = createProxyMiddleware({
  target: PROD_BACKEND,
  changeOrigin: true,
});

app.get(["/definitions/2020-09-01/{*splat}", "/listings/2021-08-01/restrictions"], passThroughProxy);

app.post("/batches/products/pricing/2022-05-01/items/competitiveSummary", passThroughProxy);

/**
 * SANDBOX PASS-THROUGH CONFIGURATION (before body parser)
 */
export const SANDBOX_BACKEND = `https://sandbox.sellingpartnerapi-${region.toLowerCase()}.amazon.com`;
const sandboxProxy = createProxyMiddleware({
  target: SANDBOX_BACKEND,
  changeOrigin: true,
});

app.get("/fba/inventory/v1/summaries", sandboxProxy);
app.post("/fba/inventory/v1/items", sandboxProxy);
app.post("/fba/inventory/v1/items/inventory", sandboxProxy);
app.delete("/fba/inventory/v1/items/{*splat}", sandboxProxy);

/**
 * BODY PARSER (after proxy routes)
 */
app.use(express.json());
app.use(express.static("public"));

/**
 * RETURN DB CONTENT
 */
app.get("/data", async (request: Request, response: Response) => {
  await Context.instance.db.read();
  const data = Context.instance.db.data;
  response.status(200).json(data);
});

/**
 * CLEAR DB CONTENT
 */
app.delete("/data", async (request: Request, response: Response) => {
  await Context.instance.clear();
  response.status(200).json({ message: "All data has been cleared." });
});

/**
 * DATA GENERATOR
 */
app.post("/chat", generateData);

/**
 * REPORTS API (deterministic, no AI agent)
 */
app.post("/reports/2021-06-30/reports", createReport);
app.get("/reports/2021-06-30/reports", getReports);
app.get("/reports/2021-06-30/reports/:reportId", getReport);
app.delete("/reports/2021-06-30/reports/:reportId", cancelReport);
app.get("/reports/2021-06-30/documents/:reportDocumentId", getReportDocument);
app.get("/reports/download/:documentId", downloadReportDocument);
app.post("/reports/2021-06-30/schedules", createReportSchedule);
app.get("/reports/2021-06-30/schedules", getReportSchedules);
app.get("/reports/2021-06-30/schedules/:reportScheduleId", getReportSchedule);
app.delete("/reports/2021-06-30/schedules/:reportScheduleId", cancelReportSchedule);

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
const shutdown = async () => {
  await shutdownTelemetry();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`
   _______     ___   ___  ____   
  / __/ _ \\   / _ | / _ \\/  _/   
 _\\ \\/ ___/  / __ |/ ___// /     
/___/_/___  /_/_|_/_/__/___/     
/_  __/ _ | /  _/ __/_  __/      
 / / / __ |_/ /_\\ \\  / /         
/_/ /_/ |_/___/___/ /_/              
`);

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
