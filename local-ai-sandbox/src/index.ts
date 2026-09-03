import express, { Request, Response } from "express";
import { configureLogging } from "@strands-agents/sdk";
import { Context, Api } from "./database/Context.js";
import { validate as validateOperationRegistry } from "./registry/operationRegistry.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { generateData } from "./controller/dataGeneratorController.js";
import { createOrder, updateOrder, deleteOrder } from "./controller/ordersManagementController.js";
import { getNotificationSchemas, sendNotification } from "./controller/notificationsManagementController.js";
import { downloadReportDocument, downloadDataKioskDocument } from "./controller/spapiController.js";
import { listScenarios, seedScenario } from "./controller/scenariosController.js";

/**
 * APPLICATION SETUP
 */
const app = express();

const port = process.env.PORT ?? "9001";
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
  const data: Record<string, Record<string, unknown>> = {};
  for (const domain of Object.values(Api)) {
    const collection = Context.instance.engine.getCollection(domain);
    if (collection) {
      const docs: Record<string, unknown> = {};
      for (const doc of collection.find()) {
        const { $loki, meta, _key, ...rest } = doc as Record<string, unknown>;
        docs[_key as string] = rest;
      }
      data[domain] = docs;
    }
  }
  response.status(200).json(data);
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
// Init database
Context.instance;

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
