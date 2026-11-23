/**
 * Data-generation primitives shared by every generator front end.
 *
 * Two agents generate sandbox data: the Strands agent behind POST /chat (via the
 * tools in this folder) and external MCP clients such as Claude Code (via
 * src/mcp/mcpServer.ts). Both must read the same models and guidance and write
 * documents under the same keys, or one of them produces records the operation
 * handlers cannot read back. Keeping the logic here, free of any agent SDK,
 * is what guarantees that.
 */
import * as fs from "node:fs";
import { Api, Context } from "../database/Context.js";
import { listingKey } from "../operation/listingsItemModel.js";
import { getModelPath } from "../registry/operationRegistry.js";
import { DOMAIN_GUIDANCE } from "./domainGuidance.js";

/** Returns the raw OpenAPI model for an Api, or undefined when none is registered. */
export function retrieveModel(api: Api): string | undefined {
  const path = getModelPath(api);
  return path ? fs.readFileSync(path, "utf8") : undefined;
}

/** Returns the sandbox-specific stored-shape guidance for an Api, or undefined when it has none. */
export function retrieveGuidance(api: Api): string | undefined {
  return DOMAIN_GUIDANCE[api];
}

/** Text returned to an agent when a domain declares no guidance. */
export function noGuidanceMessage(api: Api): string {
  return `No sandbox-specific guidance for '${api}'; generate against the API model shape.`;
}

/**
 * Resolves the storage key for generated data. Listings are keyed by seller
 * and SKU, and FBA inventory by seller SKU alone, so a generated entity must
 * carry those fields or it would be written somewhere the readers cannot
 * find it.
 */
export function resolveKey(api: Api, id: string, entity: Record<string, unknown> | undefined): { key: string; sku?: string } | { error: string } {
  if (api === Api.INVENTORY) {
    // getInventorySummaries filters on the `sellerSku` field while listing availability and the
    // order trigger look the record up by key, so the key has to be the bare SKU and nothing else.
    const sellerSku = entity?.sellerSku;
    if (typeof sellerSku !== "string" || sellerSku === "") {
      return { error: "FBA inventory needs a non-empty 'sellerSku' in the entity; it is the record's key. Add sellerSku and retry." };
    }
    return { key: sellerSku };
  }

  if (api !== Api.LISTINGS) return { key: id };

  // Returned alongside the key so the stored document cannot disagree with the
  // key it is stored under.
  const sku = typeof entity?.sku === "string" && entity.sku !== "" ? entity.sku : id;
  const sellerId = entity?.sellerId;
  if (typeof sellerId !== "string" || sellerId === "") {
    return { error: "A listing needs a non-empty 'sellerId' in the entity (a SKU is only unique per seller). Add sellerId and retry." };
  }

  return { key: listingKey(sellerId, sku), sku };
}

export type InsertResult = { ok: true; key: string } | { ok: false; error: string };

/**
 * Writes one generated entity to the database. Goes through engine.put, so the
 * write fires the declarative triggers in res/triggers.yaml exactly as any other
 * generated write does.
 */
export function insertEntity(api: Api, id: string, entity: Record<string, unknown> | undefined): InsertResult {
  const resolved = resolveKey(api, id, entity);

  if ("error" in resolved) {
    console.warn(`Database insertion rejected for api ${api} id ${id}: ${resolved.error}`);
    return { ok: false, error: resolved.error };
  }

  console.warn(`Database insertion for api ${api} key ${resolved.key}`);

  // Listings carry their SKU explicitly, since the key is no longer the SKU.
  // Assigned after the spread so a malformed `entity.sku` cannot override the
  // value the key was built from.
  const document = resolved.sku === undefined ? (entity ?? {}) : { ...entity, sku: resolved.sku };
  Context.instance.engine.put(api, resolved.key, document);

  return { ok: true, key: resolved.key };
}

/**
 * Snapshot of the stored documents keyed by domain then storage key, with the
 * engine's internal bookkeeping fields stripped. Restrict to one domain with `only`.
 */
export function snapshotData(only?: Api): Record<string, Record<string, unknown>> {
  const data: Record<string, Record<string, unknown>> = {};
  const domains = only ? [only] : Object.values(Api);
  for (const domain of domains) {
    const collection = Context.instance.engine.getCollection(domain);
    if (collection) {
      const docs: Record<string, unknown> = {};
      for (const doc of collection.find()) {
        const { _key, ...rest } = doc as Record<string, unknown>;
        delete rest.$loki;
        delete rest.meta;
        docs[_key as string] = rest;
      }
      data[domain] = docs;
    }
  }
  return data;
}
