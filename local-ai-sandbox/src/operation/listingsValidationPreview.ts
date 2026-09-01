/**
 * Synchronous validation for putListingsItem, delegated to production.
 *
 * Rather than reimplement Amazon's validation, every PUT calls the real API
 * with `mode=VALIDATION_PREVIEW`, which returns the full synchronous result
 * without mutating production.
 *
 * PUT therefore requires real credentials — deliberate, since a local
 * approximation would go stale and teach callers the wrong rules.
 */
import type { Request } from "express";
import { PROD_BACKEND } from "./passThroughOperations.js";
import { ISSUE_CODE_ASIN_MISMATCH, ISSUE_CODE_UNMATCHABLE, type ListingIssue } from "./listingsItemModel.js";

const PREVIEW_TIMEOUT_MS = Number(process.env.PREVIEW_TIMEOUT_MS) || 10_000;

/**
 * Catalog-matching issues, dropped here: production judges them against the
 * real catalog, which knows nothing of sandbox-only ASINs, so its verdict does
 * not transfer. Matching is decided against the sandbox catalog by the listings
 * trigger.
 */
const MATCHING_ISSUE_CODES = new Set([ISSUE_CODE_ASIN_MISMATCH, ISSUE_CODE_UNMATCHABLE]);

export type PreviewOutcome =
  | { outcome: "VALID"; issues: ListingIssue[] }
  | { outcome: "INVALID"; issues: ListingIssue[] }
  | { outcome: "NO_CREDENTIALS" }
  | { outcome: "UNAVAILABLE"; detail: string };

/**
 * Validates a putListingsItem submission against production.
 * Never throws: transport failures are reported as `UNAVAILABLE` so the
 * caller can answer with an upstream error rather than a false pass.
 */
export async function runValidationPreview(request: Request): Promise<PreviewOutcome> {
  const accessToken = typeof request.header === "function" ? request.header("x-amz-access-token") : undefined;
  if (!accessToken) return { outcome: "NO_CREDENTIALS" };

  // Rebuild the query string so the caller's own `mode` cannot leak through.
  const params = new URLSearchParams(request.originalUrl.split("?")[1] ?? "");
  params.set("mode", "VALIDATION_PREVIEW");
  const url = `${PROD_BACKEND}${request.path}?${params.toString()}`;

  try {
    const response = await globalThis.fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-amz-access-token": accessToken },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { outcome: "UNAVAILABLE", detail: `validation preview returned HTTP ${String(response.status)}` };
    }

    const body = (await response.json()) as { status?: string; issues?: ListingIssue[] };
    // A preview answers VALID or INVALID. Anything else means the contract
    // changed, so report it rather than guessing at its meaning.
    const passed = body.status === "VALID";
    if (!passed && body.status !== "INVALID") {
      return { outcome: "UNAVAILABLE", detail: `validation preview returned an unrecognized status '${String(body.status)}'` };
    }

    const issues = (body.issues ?? []).filter((issue) => !MATCHING_ISSUE_CODES.has(issue.code));

    // Dropping the matching issues can leave a rejection with nothing left to
    // report, which means production only objected to matching: pass it and
    // let the sandbox decide the catalog outcome itself.
    if (!passed && issues.length === 0) return { outcome: "VALID", issues: [] };

    return { outcome: passed ? "VALID" : "INVALID", issues };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "validation preview call failed";
    return { outcome: "UNAVAILABLE", detail };
  }
}
