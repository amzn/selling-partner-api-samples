/**
 * Downloads notification event/payload JSON schema files from the upstream
 * `amzn/selling-partner-api-models` GitHub repository into `res/notification-schemas/`,
 * filtered by the allowlist in `scripts/config/notificationSchemasConfig.ts`.
 *
 * Always fetches from the `main` branch of the upstream repository.
 *
 * Usage:
 *   tsx scripts/fetchNotificationSchemas.ts
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { NOTIFICATION_SCHEMA_ALLOWLIST } from "./config/notificationSchemasConfig.js";

/**
 * Git ref that notification schemas are always fetched from.
 */
export const NOTIFICATION_SCHEMAS_REF = "main";

/**
 * Derives the notification type identifier from a schema filename.
 * Strips the `.json` extension from the filename.
 */
export function deriveNotificationType(filename: string): string {
  return filename.replace(/\.json$/, "");
}

/**
 * Filters upstream schema files against the allowlist.
 * Returns matched files (type → absolute path) and allowlist entries with no match.
 */
export function filterSchemas(schemasDir: string, allowlist: string[]): { toCopy: Map<string, string>; missing: string[] } {
  const files = fs.readdirSync(schemasDir).filter((f) => f.endsWith(".json"));
  const availableTypes = new Map<string, string>();
  for (const file of files) {
    const type = deriveNotificationType(file);
    availableTypes.set(type, path.join(schemasDir, file));
  }

  const toCopy = new Map<string, string>();
  const missing: string[] = [];

  for (const entry of allowlist) {
    const absPath = availableTypes.get(entry);
    if (absPath) {
      toCopy.set(entry, absPath);
    } else {
      missing.push(entry);
    }
  }

  return { toCopy, missing };
}

const UPSTREAM_REPO = "https://github.com/amzn/selling-partner-api-models.git";
const UPSTREAM_SCHEMAS_SUBDIR = "schemas/notifications";

/**
 * Performs a shallow sparse clone of the upstream repository, checking out only the
 * `schemas/notifications/` subdirectory into an OS temp directory.
 *
 * Always clones the `main` branch (see `NOTIFICATION_SCHEMAS_REF`).
 *
 * The caller owns `tmpRoot` (typically created via `fs.mkdtempSync`) and is
 * responsible for cleaning it up, so the directory is removed even when the
 * clone fails partway through.
 *
 * @param tmpRoot The caller-owned temp directory to clone into.
 * @returns The resolved path to the `schemas/notifications/` directory within `tmpRoot`.
 */
export function sparseCloneNotificationSchemas(tmpRoot: string): string {
  const git = (args: string[]) => execFileSync("git", args, { cwd: tmpRoot, stdio: "pipe" });
  execFileSync(
    "git",
    ["clone", "--depth", "1", "--filter=blob:none", "--sparse", "--branch", NOTIFICATION_SCHEMAS_REF, UPSTREAM_REPO, tmpRoot],
    { stdio: "pipe" },
  );
  git(["sparse-checkout", "set", UPSTREAM_SCHEMAS_SUBDIR]);
  return path.join(tmpRoot, "schemas", "notifications");
}

const DEST_DIR = "res/notification-schemas";

/**
 * Orchestrates the full notification schema fetch pipeline.
 * Entry point when run as a script.
 */
export function main(): void {
  console.log(`[notifications:fetch] cloning ${UPSTREAM_REPO} @ ${NOTIFICATION_SCHEMAS_REF} (sparse: ${UPSTREAM_SCHEMAS_SUBDIR})`);

  if (NOTIFICATION_SCHEMA_ALLOWLIST.length === 0) {
    console.log("[notifications:fetch] No notification types configured — skipping.");
    return;
  }

  // Create the temp dir here so the finally block always owns the handle and can
  // clean it up even when the clone throws partway through.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sp-api-notification-schemas-"));

  // Defer process.exit until after cleanup: process.exit() terminates
  // immediately and skips finally blocks, which would otherwise leak tmpRoot.
  // A `return` inside the try would likewise bypass the post-finally exit, so
  // the flow below uses a flag and plain branching instead of early returns.
  let shouldExitWithError = false;
  try {
    let schemasDir: string | null = null;
    try {
      schemasDir = sparseCloneNotificationSchemas(tmpRoot);
    } catch (err) {
      console.error(`[notifications:fetch] clone failed: ${err instanceof Error ? err.message : String(err)}`);
      shouldExitWithError = true;
    }

    if (schemasDir !== null) {
      const { toCopy, missing } = filterSchemas(schemasDir, NOTIFICATION_SCHEMA_ALLOWLIST);

      fs.mkdirSync(DEST_DIR, { recursive: true });

      let copied = 0;

      for (const [type, srcPath] of toCopy) {
        const destPath = path.join(DEST_DIR, type + ".json");
        try {
          fs.copyFileSync(srcPath, destPath);
          copied++;
          console.log(`[notifications:fetch] copied ${type} → ${destPath}`);
        } catch (err) {
          shouldExitWithError = true;
          console.error(`[notifications:fetch] failed to write ${destPath}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      for (const entry of missing) {
        console.log(`[notifications:fetch] warning: no upstream schema found for "${entry}"`);
      }

      console.log(`[notifications:fetch] done: ${String(copied)} copied, ${String(missing.length)} missing.`);
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  // Cleanup has run; now it is safe to terminate with a non-zero exit code.
  if (shouldExitWithError) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
