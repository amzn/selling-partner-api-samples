/**
 * Copies SP-API OpenAPI model files from the upstream GitHub repository into res/models/,
 * filtered by the allowlist/exclude list and sanitized (sandbox-only content removed).
 *
 * Usage:
 *   tsx scripts/fetchModels.ts               # fetch from the default ref (main)
 *   tsx scripts/fetchModels.ts --ref v1.2.3  # fetch from a pinned tag/commit for reproducibility
 *
 * After running, regenerate the registry: `npm run registry:generate` (or use `npm run models:sync`).
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { ALLOWLIST, isExcluded, deriveApiName } from "./config/apiRegistrationConfig.js";

const UPSTREAM_REPO = "https://github.com/amzn/selling-partner-api-models.git";
const UPSTREAM_MODELS_SUBDIR = "models";
const DEST_DIR = "res/models";

/** The subset of a Swagger 2.0 model this script reads. */
interface SwaggerModel {
  info?: { version?: string; title?: string };
}

/**
 * Recursively removes every `examples` and `x-amzn-api-sandbox` property at any depth.
 * `example` (singular) is intentionally preserved (openapi-enforcer suppresses those separately).
 * Pure and idempotent: returns a new structure, mutates nothing.
 */
export function sanitizeModel(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeModel);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (key === "examples" || key === "x-amzn-api-sandbox") continue;
      out[key] = sanitizeModel(v);
    }
    return out;
  }
  return value;
}

function argRef(): string {
  const i = process.argv.indexOf("--ref");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : "main";
}

/** Shallow, sparse clone of only the upstream models directory into a temp dir; returns its path. */
function sparseCloneModels(ref: string): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sp-api-models-"));
  const git = (args: string[]) => execFileSync("git", args, { cwd: tmp, stdio: "pipe" });
  execFileSync("git", ["clone", "--depth", "1", "--filter=blob:none", "--sparse", "--branch", ref, UPSTREAM_REPO, tmp], { stdio: "pipe" });
  git(["sparse-checkout", "set", UPSTREAM_MODELS_SUBDIR]);
  return path.join(tmp, UPSTREAM_MODELS_SUBDIR);
}

/**
 * All *.json model files under the allowlisted upstream folders. An empty ALLOWLIST means "all
 * folders" (exclude-list-only mode).
 */
function allowlistedModelFiles(modelsRoot: string): { folder: string; file: string; absPath: string }[] {
  const results: { folder: string; file: string; absPath: string }[] = [];
  const folders =
    ALLOWLIST.length > 0 ? ALLOWLIST : fs.readdirSync(modelsRoot).filter((f) => fs.statSync(path.join(modelsRoot, f)).isDirectory());
  for (const folder of folders) {
    const dir = path.join(modelsRoot, folder);
    if (!fs.existsSync(dir)) {
      console.warn(`[models:fetch] allowlisted folder not found upstream: ${folder}`);
      continue;
    }
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith(".json")) results.push({ folder, file, absPath: path.join(dir, file) });
    }
  }
  return results;
}

function main(): void {
  const ref = argRef();
  console.log(`[models:fetch] cloning ${UPSTREAM_REPO} @ ${ref} (sparse: ${UPSTREAM_MODELS_SUBDIR})`);
  const modelsRoot = sparseCloneModels(ref);
  fs.mkdirSync(DEST_DIR, { recursive: true });

  let copied = 0;
  let skipped = 0;
  for (const { file, absPath } of allowlistedModelFiles(modelsRoot)) {
    const raw = JSON.parse(fs.readFileSync(absPath, "utf8")) as SwaggerModel;
    const apiName = deriveApiName(raw.info?.title, file);
    const apiVersion: string = raw.info?.version ?? "";
    if (isExcluded({ apiName, apiVersion, modelFile: file })) {
      skipped++;
      continue;
    }
    const sanitized = sanitizeModel(raw);
    fs.writeFileSync(path.join(DEST_DIR, file), JSON.stringify(sanitized, null, 2) + "\n", "utf8");
    copied++;
    console.log(`[models:fetch] ${apiName} ${apiVersion} → ${file}`);
  }

  console.log(`[models:fetch] done: ${String(copied)} copied, ${String(skipped)} skipped (excluded). Run "npm run registry:generate" next.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
