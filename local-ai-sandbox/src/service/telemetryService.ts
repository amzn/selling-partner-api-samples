import { MeterProvider, PeriodicExportingMetricReader, AggregationTemporality } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import type { Counter, Histogram } from "@opentelemetry/api";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const SERVICE_NAME = "sp-api-sandbox";
const SERVICE_VERSION = "1.0.0";
const OTLP_ENDPOINT = "https://us-east-1.prod.mcp-telemetry.dev-tools.aws.dev/v1/metrics";
const EXPORT_INTERVAL_MS = 60_000;
const EXPORT_TIMEOUT_MS = 10_000;
const INSTALL_DIR = join(homedir(), ".sp-api-sandbox");
const INSTALL_FILE = join(INSTALL_DIR, "installation_id");

const enabled = () => process.env.SP_API_SANDBOX_TELEMETRY_ENABLED !== "false";

let cachedInstallId: string | null = null;
let sessionId: string | null = null;

function getInstallationId(): string {
  if (cachedInstallId) return cachedInstallId;
  try {
    if (!existsSync(INSTALL_DIR)) mkdirSync(INSTALL_DIR, { recursive: true });
    if (existsSync(INSTALL_FILE)) {
      const id = readFileSync(INSTALL_FILE, "utf-8").trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        cachedInstallId = id;
        return id;
      }
    }
    const newId = randomUUID();
    writeFileSync(INSTALL_FILE, newId, "utf-8");
    cachedInstallId = newId;
    return newId;
  } catch {
    cachedInstallId = randomUUID();
    return cachedInstallId;
  }
}

function getSessionId(): string {
  sessionId ??= randomUUID();
  return sessionId;
}

let meterProvider: MeterProvider | null = null;
let requestCounter: Counter | null = null;
let responseTimeHistogram: Histogram | null = null;
let errorCounter: Counter | null = null;
let newUserCounter: Counter | null = null;
const seenInstallations = new Set<string>();

function init() {
  if (!enabled()) return;
  try {
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
      "mcp.installation.id": getInstallationId(),
    });
    const exporter = new OTLPMetricExporter({
      url: OTLP_ENDPOINT,
      timeoutMillis: EXPORT_TIMEOUT_MS,
      temporalityPreference: AggregationTemporality.DELTA,
    });
    const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: EXPORT_INTERVAL_MS });
    meterProvider = new MeterProvider({ resource, readers: [reader] });
    const meter = meterProvider.getMeter(SERVICE_NAME, SERVICE_VERSION);
    requestCounter = meter.createCounter("mcp.tool.invocations", { description: "Total sandbox requests" });
    responseTimeHistogram = meter.createHistogram("mcp.tool.duration", { description: "Response time in ms", unit: "ms" });
    errorCounter = meter.createCounter("mcp.errors", { description: "Server errors" });
    newUserCounter = meter.createCounter("mcp.new_installations", { description: "New unique installations" });
  } catch {
    /* fail-safe */
  }
}

export function trackRequest(apiSection: string, responseTime: number, serverResponse: number) {
  if (!enabled() || !requestCounter) return;
  try {
    const installId = getInstallationId();
    const attrs = { "mcp.tool.name": apiSection, "mcp.installation.id": installId, "mcp.session.id": getSessionId() };
    requestCounter.add(1, { ...attrs, "mcp.tool.status": serverResponse < 500 ? "success" : "error" });
    responseTimeHistogram!.record(responseTime, attrs);
    if (serverResponse >= 500) errorCounter!.add(1, { ...attrs, "mcp.error.type": `HTTP_${serverResponse}` });
    if (!seenInstallations.has(installId)) {
      seenInstallations.add(installId);
      newUserCounter!.add(1, { new_user: true, "mcp.installation.id": installId });
    }
  } catch {
    /* fail-safe */
  }
}

export function identifyApiSection(path: string): string {
  if (path.includes("/listings/")) return "listings";
  if (path.includes("/orders/")) return "orders";
  if (path.includes("/catalog/")) return "catalog";
  if (path.includes("/fba/inventory/")) return "fba_inventory";
  if (path.includes("/externalFulfillment/")) return "external_fulfillment";
  if (path.includes("/reports/")) return "reports";
  if (path.includes("/products/pricing/") || path.includes("/batches/products/pricing/")) return "pricing";
  if (path.includes("/definitions/")) return "definitions";
  return "other";
}

export async function shutdownTelemetry(): Promise<void> {
  if (meterProvider) {
    await meterProvider.shutdown();
    meterProvider = null;
  }
}

init();
