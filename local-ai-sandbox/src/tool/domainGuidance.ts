/**
 * Per-domain data-generation guidance.
 *
 * The data generator (POST /chat) learns a domain's shape from its raw OpenAPI
 * model, but that model describes the API *response* shape, not the sandbox's
 * *stored* document shape. Where the two diverge — system-managed fields a
 * model cannot mention (Listings `mfnAvailability`), or a `_type` discriminator
 * the handlers query on but the model never declares (Finances) — the generator
 * needs facts no resource it can read provides.
 *
 * This registry holds those facts, one entry per `Api` namespace. Each entry is
 * authored beside the operation handlers / document model it describes (so the
 * guidance cannot drift from the shape), and gathered here. The
 * `guidanceRetrievalTool` surfaces an entry on demand for the single domain the
 * generator actually chose, instead of dumping every domain's guidance into
 * every prompt.
 *
 * Adding a domain whose stored shape differs from its API model? Add an entry
 * here. Nothing forces you to: the registry is `Partial`, a domain whose stored
 * shape matches its model is meant to have none, so a forgotten entry is not
 * caught at boot — it surfaces as the generator producing records the handlers
 * cannot read back. The only boot check is `assertGuidanceMatchesRegistry`,
 * which catches the opposite mistake (an entry naming a namespace the registry
 * does not know), not a missing one.
 */
import { tool } from "@strands-agents/sdk";
import { Api } from "../database/Context.js";
import { isDbNamespace } from "../registry/operationRegistry.js";
import { LISTINGS_GENERATION_GUIDANCE } from "../operation/listingsItemModel.js";
import { FINANCES_GENERATION_GUIDANCE } from "../operation/financesOperations.js";
import { TRANSFERS_GENERATION_GUIDANCE } from "../operation/transfersOperations.js";
import z from "zod";

/**
 * Data-generation guidance keyed by DB namespace. Partial by design: a domain
 * whose stored shape matches its API model needs no entry, because the raw
 * model the generator already reads is enough.
 */
export const DOMAIN_GUIDANCE: Partial<Record<Api, string>> = {
  [Api.LISTINGS]: LISTINGS_GENERATION_GUIDANCE,
  [Api.FINANCES]: FINANCES_GENERATION_GUIDANCE,
  [Api.TRANSFERS]: TRANSFERS_GENERATION_GUIDANCE,
};

/** The namespaces that declare data-generation guidance. */
export function domainsWithGuidance(): Api[] {
  return Object.keys(DOMAIN_GUIDANCE) as Api[];
}

/**
 * Fails fast if the guidance registry has drifted from the operation registry.
 *
 * The same spirit as `assertEnumMatchesRegistry` in Context.ts: the registry
 * is the runtime source of truth for which namespaces exist, so a guidance
 * entry that names a namespace the registry does not know about is a mistake
 * (a renamed/removed `Api` member leaving dead guidance behind, or a non-empty
 * entry that would never be reachable). Call once at startup.
 */
export function assertGuidanceMatchesRegistry(): void {
  const unknown = domainsWithGuidance().filter((ns) => !isDbNamespace(ns));
  if (unknown.length > 0) {
    throw new Error(
      `Domain guidance is out of sync with the operation registry. ` +
        `These guidance entries name namespaces the registry does not know: [${unknown.join(", ")}]. ` +
        `Remove them from DOMAIN_GUIDANCE in src/tool/domainGuidance.ts, or add the namespace to the registry.`,
    );
  }
}

export const guidanceRetrievalTool = tool({
  name: "guidance_retrieval",
  description:
    "Retrieves sandbox-specific data-generation guidance for a given Api: how the stored document " +
    "shape differs from the API model, which fields the handlers key and filter on, and any " +
    "system-managed fields. Call this for the domain you are generating data for before inserting. " +
    "Returns guidance text, or a note that the domain has none (then the API model alone is enough).",
  inputSchema: z.object({
    api: z.enum(Api),
  }),
  callback: (input) => {
    console.warn(`Guidance retrieval for api ${input.api}`);
    const guidance = DOMAIN_GUIDANCE[input.api];
    return guidance ?? `No sandbox-specific guidance for '${input.api}'; generate against the API model shape.`;
  },
});
