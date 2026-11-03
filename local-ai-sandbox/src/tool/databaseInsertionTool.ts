import { tool } from "@strands-agents/sdk";
import { Api, Context } from "../database/Context.js";
import { listingKey } from "../operation/listingsItemModel.js";
import z from "zod";

/**
 * Resolves the storage key for generated data. Listings are keyed by seller
 * and SKU, and FBA inventory by seller SKU alone, so a generated entity must
 * carry those fields or it would be written somewhere the readers cannot
 * find it.
 */
function resolveKey(api: Api, id: string, entity: Record<string, unknown> | undefined): { key: string; sku?: string } | { error: string } {
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

export const databaseInsertionTool = tool({
  name: "database_insertion",
  description:
    "Inserts data into the database. For listings, the entity must include 'sellerId' and 'sku'; the storage key is derived from both, so 'id' is ignored there.",
  inputSchema: z.object({
    api: z.enum(Api),
    id: z.string(),
    entity: z.any(),
  }),
  callback: (input) => {
    const entity = input.entity as Record<string, unknown> | undefined;
    const resolved = resolveKey(input.api, input.id, entity);

    if ("error" in resolved) {
      console.warn(`Database insertion rejected for api ${input.api} id ${input.id}: ${resolved.error}`);
      return Promise.resolve(resolved.error);
    }

    console.warn(`Database insertion for api ${input.api} key ${resolved.key}`);

    // Listings carry their SKU explicitly, since the key is no longer the SKU.
    // Assigned after the spread so a malformed `entity.sku` cannot override the
    // value the key was built from.
    const document = resolved.sku === undefined ? (entity ?? {}) : { ...entity, sku: resolved.sku };
    Context.instance.engine.put(input.api, resolved.key, document);

    return Promise.resolve("Success");
  },
});
