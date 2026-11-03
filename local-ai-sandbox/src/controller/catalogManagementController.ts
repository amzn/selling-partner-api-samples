/**
 * Catalog management — seeding the sandbox catalog from production, and
 * re-running catalog matching on demand.
 *
 * Importing is deliberately an explicit, separate act rather than something a
 * submission does implicitly. An earlier design resolved unknown ASINs from
 * inside putListingsItem, which made whether a submission matched depend on
 * network reachability. Here the seller imports first and submits afterwards,
 * so catalog matching is decided entirely against the sandbox catalog.
 *
 * This is not the sandbox's only production dependency — pass-through
 * operations forward to production, and putListingsItem validates against it.
 * What importing keeps local is the matching decision.
 */
import { Request, Response } from "express";
import { Api, Context } from "../database/Context.js";
import { PROD_BACKEND } from "../operation/passThroughOperations.js";
import { getAllowedMarketplaceIds } from "../marketplaceIds.js";
import { reconcileAllListings } from "../service/catalogMatching.js";

const IMPORT_TIMEOUT_MS = Number(process.env.IMPORT_TIMEOUT_MS) || 10_000;

/**
 * Per-request ASIN cap. Imports run sequentially against a rate-limited
 * production operation, so a large batch would be slow and impolite rather
 * than fast.
 */
const MAX_ASINS_PER_REQUEST = 20;

/** Everything the sandbox can serve back from a catalog item. */
const IMPORT_INCLUDED_DATA = "attributes,dimensions,identifiers,images,productTypes,relationships,salesRanks,summaries";

/** One ASIN that could not be imported, and why. */
interface ImportFailure {
  asin: string;
  reason: string;
}

/**
 * Narrows the request body to the ASINs and marketplace to import, or explains
 * what is wrong.
 *
 * `marketplaceId` is required rather than defaulted. A catalog item exists per
 * marketplace, so guessing one would import against a store the caller did not
 * mean and report a confusing "not found" for an ASIN that plainly exists.
 */
function parseImportRequest(body: unknown): { asins: string[]; marketplaceId: string } | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Request body must be a valid JSON object" };
  }
  const fields = body as Record<string, unknown>;

  const raw = fields.asins;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Request body must contain a non-empty 'asins' array" };
  }
  if (raw.length > MAX_ASINS_PER_REQUEST) {
    return { error: `A single import is limited to ${String(MAX_ASINS_PER_REQUEST)} ASINs; ${String(raw.length)} were provided` };
  }
  const asins = raw.map((value) => (typeof value === "string" ? value.trim() : ""));
  if (asins.some((asin) => asin === "")) {
    return { error: "Every entry in 'asins' must be a non-empty string" };
  }

  const marketplaceId = typeof fields.marketplaceId === "string" ? fields.marketplaceId.trim() : "";
  if (marketplaceId === "") {
    return { error: "Request body must contain a 'marketplaceId': a catalog item exists per marketplace, so it cannot be inferred" };
  }
  const allowed = getAllowedMarketplaceIds();
  if (!allowed.includes(marketplaceId)) {
    return { error: `Marketplace ID '${marketplaceId}' is not valid for the configured region` };
  }

  return { asins, marketplaceId };
}

/** Either the imported item or the reason it could not be imported. */
type FetchResult = { ok: true; asin: string; item: Record<string, unknown> } | { ok: false; failure: ImportFailure };

/**
 * Fetches one catalog item from production.
 * Never throws: a transport failure is one ASIN's problem, not the request's.
 */
async function fetchCatalogItem(asin: string, marketplaceId: string, accessToken: string): Promise<FetchResult> {
  const url = `${PROD_BACKEND}/catalog/2022-04-01/items/${encodeURIComponent(asin)}?marketplaceIds=${encodeURIComponent(marketplaceId)}&includedData=${IMPORT_INCLUDED_DATA}`;

  try {
    const response = await globalThis.fetch(url, {
      method: "GET",
      headers: { "x-amz-access-token": accessToken },
      signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS),
    });

    if (response.status === 404) {
      return { ok: false, failure: { asin, reason: "not found in the production catalog for this marketplace" } };
    }
    if (!response.ok) {
      return { ok: false, failure: { asin, reason: `production returned HTTP ${String(response.status)}` } };
    }

    const item = (await response.json()) as Record<string, unknown>;
    if (typeof item.asin !== "string") {
      return { ok: false, failure: { asin, reason: "production returned a catalog item without an ASIN" } };
    }
    return { ok: true, asin: item.asin, item };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "request failed";
    return { ok: false, failure: { asin, reason: detail } };
  }
}

/**
 * POST /manage/catalog/import
 *
 * Copies catalog items from the production catalog into the sandbox so an
 * offer-only listing can be attached to a genuine ASIN without drawing a
 * matching issue. Requires a real access token, since production is the only
 * source for this data.
 *
 * Matching is re-run afterwards, so a listing already tagged for one of these
 * ASINs clears in the same request rather than waiting for the scheduled sweep.
 */
export const importCatalogItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = parseImportRequest(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { marketplaceId } = parsed;

    const accessToken = req.header("x-amz-access-token");
    if (!accessToken) {
      res.status(401).json({
        error: "Importing requires a valid 'x-amz-access-token': the production catalog is the only source for a real ASIN.",
      });
      return;
    }

    const imported: string[] = [];
    const failed: ImportFailure[] = [];

    // Sequential on purpose: getCatalogItem is rate limited, and an import of
    // a handful of ASINs is not worth risking a throttle for.
    for (const asin of parsed.asins) {
      const result = await fetchCatalogItem(asin, marketplaceId, accessToken);
      if (!result.ok) {
        failed.push(result.failure);
        continue;
      }
      Context.instance.engine.put(Api.CATALOG, result.asin, result.item);
      imported.push(result.asin);
      console.info(`[Catalog] Imported ${result.asin} from production (${marketplaceId})`);
    }

    // Nothing landed and something was attempted: report it as an upstream
    // failure rather than a success with an empty list.
    if (imported.length === 0) {
      res.status(502).json({ error: "No catalog items could be imported", imported, failed, marketplaceId });
      return;
    }

    const reconciled = reconcileAllListings();

    res.status(200).json({ imported, failed, marketplaceId, reconciled });
  } catch (error) {
    console.error("Error in importCatalogItems:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /manage/catalog/reprocess-matching
 *
 * Runs the same sweep the scheduled job runs. The scheduler models
 * production's unhurried re-matching; this exists so a demo or a test does not
 * have to wait for the next tick to see the result.
 */
export const reprocessMatching = (_req: Request, res: Response): void => {
  try {
    const { evaluated, changed } = reconcileAllListings();
    res.status(200).json({
      evaluated,
      changed,
      message: `Re-evaluated matching for ${String(evaluated)} listing(s); ${String(changed)} changed.`,
    });
  } catch (error) {
    console.error("Error in reprocessMatching:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
