/**
 * Extracts operations from the local OpenAPI model files into a single Operation Registry
 * (res/generated/operationRegistry.json), the source of truth every runtime call site reads.
 *
 * Usage:
 *   tsx scripts/generateOperationRegistry.ts          # write the registry
 *   tsx scripts/generateOperationRegistry.ts --check  # fail (exit 1) if the committed registry is stale
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { deriveApiName, deriveDbNamespace, isExcluded, isOperationExcluded, overrideFor } from "./config/apiRegistrationConfig.js";
import type { OperationEntry, ModelIndexEntry, OperationRegistry } from "../src/registry/operationRegistry.js";

const MODELS_DIR = "res/models";
const OUTPUT_FILE = "res/generated/operationRegistry.json";
const HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch", "head", "options"]);

/** The subset of a Swagger 2.0 model this script reads. */
interface SwaggerModel {
  info?: { version?: string; title?: string };
  paths?: Record<string, Record<string, { operationId?: string; deprecated?: boolean }>>;
}

/** Longest common static prefix of the given paths, stopping before the first parameterized ("{...}") segment. */
export function computePathPrefix(paths: string[]): string {
  if (paths.length === 0) return "";
  const split = paths.map((p) => p.split("/"));
  const first = split[0];
  const out: string[] = [];
  for (let i = 0; i < first.length; i++) {
    const seg = first[i];
    if (seg.includes("{")) break;
    if (split.every((parts) => parts[i] === seg)) out.push(seg);
    else break;
  }
  return out.join("/");
}

/** Build the registry from the model files found in MODELS_DIR. */
export function buildRegistry(modelsDir = MODELS_DIR): OperationRegistry {
  const operations: OperationEntry[] = [];
  const models: ModelIndexEntry[] = [];

  const files = fs
    .readdirSync(modelsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  for (const modelFile of files) {
    const model = JSON.parse(fs.readFileSync(path.join(modelsDir, modelFile), "utf8")) as SwaggerModel;
    const apiVersion: string = model.info?.version ?? "";
    const apiName = deriveApiName(model.info?.title, modelFile);
    const dbNamespace = deriveDbNamespace(apiName, modelFile);

    if (isExcluded({ apiName, apiVersion, modelFile })) continue;

    const paths = model.paths ?? {};
    const pathPrefix = computePathPrefix(Object.keys(paths));

    models.push({
      modelFile,
      apiName,
      apiVersion,
      pathPrefix,
      dbNamespace,
      resourcePath: overrideFor(modelFile)?.resourcePath ?? null,
    });

    for (const p of Object.keys(paths)) {
      const pathItem = paths[p] as Record<string, unknown>;
      // Skip sandbox-only paths (x-amzn-api-sandbox-only at the path-item level).
      if (pathItem["x-amzn-api-sandbox-only"] === true) continue;
      for (const method of Object.keys(paths[p])) {
        if (!HTTP_METHODS.has(method.toLowerCase())) continue;
        const op = paths[p][method];
        const operationId = op.operationId;
        if (!operationId) continue;
        if (op.deprecated === true) continue; // schema-deprecated operations are dropped automatically
        if (isOperationExcluded({ apiName, apiVersion, modelFile }, operationId)) continue;
        operations.push({ operationId, apiName, apiVersion, modelFile, path: p, method: method.toLowerCase(), dbNamespace, pathPrefix });
      }
    }
  }

  // Deterministic ordering so regeneration is byte-stable.
  operations.sort(
    (a, b) =>
      a.apiName.localeCompare(b.apiName) || a.apiVersion.localeCompare(b.apiVersion) || a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
  models.sort((a, b) => a.apiName.localeCompare(b.apiName) || a.apiVersion.localeCompare(b.apiVersion));

  return { operations, models };
}

function serialize(registry: OperationRegistry): string {
  return JSON.stringify(registry, null, 2) + "\n";
}

function main(): void {
  const checkMode = process.argv.includes("--check");
  const registry = buildRegistry();
  const output = serialize(registry);

  if (checkMode) {
    const existing = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, "utf8") : "";
    if (existing !== output) {
      console.error(`[registry:check] ${OUTPUT_FILE} is stale. Run "npm run registry:generate" and commit the result.`);
      process.exit(1);
    }
    console.log(`[registry:check] ${OUTPUT_FILE} is up to date (${String(registry.operations.length)} operations, ${String(registry.models.length)} models).`);
    return;
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, output, "utf8");
  console.log(`[registry:generate] Wrote ${OUTPUT_FILE}: ${String(registry.operations.length)} operations across ${String(registry.models.length)} models.`);
}

// Run only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
