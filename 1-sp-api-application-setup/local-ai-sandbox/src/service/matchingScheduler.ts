/**
 * Scheduled catalog reconciliation.
 *
 * The listings write trigger only fires when a listing is written, so it
 * cannot notice a catalog item that arrives afterwards — an offer-only listing
 * tagged 4005015 would keep the issue forever even once its ASIN is imported.
 * This sweep re-evaluates every listing on a timer, which is closer to how
 * production re-matches asynchronously than reacting to catalog writes would
 * be: no write cascade, and its termination does not depend on a `silent` flag.
 *
 * The interval is the only knob. Setting MATCHING_INTERVAL_MS=0 disables the
 * job, which is what the test environment does — a timer firing mid-suite
 * would mutate the database under a running test.
 */
import { reconcileAllListings } from "./catalogMatching.js";

/** Default sweep interval. Short enough to feel immediate while developing. */
const DEFAULT_INTERVAL_MS = 60_000;

/** Read when the scheduler starts, so a test can set it without reloading. */
function resolveIntervalMs(): number {
  const raw = process.env.MATCHING_INTERVAL_MS;
  if (raw === undefined) return DEFAULT_INTERVAL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid MATCHING_INTERVAL_MS environment variable: "${raw}". Must be a non-negative number of milliseconds, or 0 to disable.`);
  }
  return parsed;
}

let timer: NodeJS.Timeout | null = null;

/**
 * Runs one sweep, swallowing failures. A scheduled job must never take the
 * process down, and there is no caller to hand the error to.
 */
export function runMatchingSweep(): void {
  try {
    const { evaluated, changed } = reconcileAllListings();
    // Only worth a line when something actually moved: this runs every minute
    // for the life of the process.
    if (changed > 0) {
      console.info(`[Matching] Scheduled sweep updated ${String(changed)} of ${String(evaluated)} listing(s)`);
    }
  } catch (error) {
    console.error("[Matching] Scheduled sweep failed:", error);
  }
}

/**
 * Starts the sweep timer. Idempotent, and a no-op when the interval is 0.
 * The timer is unref'd so it never keeps the process alive on its own.
 */
export function startMatchingScheduler(): void {
  if (timer) return;

  const intervalMs = resolveIntervalMs();
  if (intervalMs === 0) {
    console.info("[Matching] Scheduled reconciliation disabled (MATCHING_INTERVAL_MS=0)");
    return;
  }

  timer = setInterval(runMatchingSweep, intervalMs);
  timer.unref();
  console.info(`[Matching] Scheduled reconciliation every ${String(intervalMs)}ms`);
}

/** Stops the sweep timer. Used by tests, and safe to call when not running. */
export function stopMatchingScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

/** Test-only: whether the timer is currently armed. */
export function isMatchingSchedulerRunning(): boolean {
  return timer !== null;
}
