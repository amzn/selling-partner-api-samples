import { tool } from "@strands-agents/sdk";
import z from "zod";
import { Api, Context } from "../database/Context.js";

export async function databaseLookupCallback(input: { api: Api; id?: string; ids?: string[]; asin?: string; asins?: string[]; fields?: string[] }) {
  const isCatalog = input.api === Api.CATALOG;
  const identifier = isCatalog ? input.asin : input.id;
  const identifiers = isCatalog ? input.asins : input.ids;
  console.warn(`Database lookup for ${input.api} and ${isCatalog ? "asin" : "id"} ${identifier} ${isCatalog ? "asins" : "ids"} ${identifiers}`);
  await Context.instance.db.read();
  const apiData = Context.instance.db.data[input.api];
  if (apiData) {
    const pick = (obj: any) => {
      if (!obj || !input.fields) return obj;
      const picked: Record<string, any> = {};
      for (const f of input.fields) picked[f] = obj[f] ?? null;
      return picked;
    };
    if (identifiers) {
      const results: Record<string, any> = {};
      for (const id of identifiers) {
        results[id] = apiData[id] ? pick(apiData[id]) : null;
      }
      return JSON.stringify(results);
    }
    const result = identifier
      ? pick(apiData[identifier])
      : input.fields
        ? Object.fromEntries(Object.entries(apiData).map(([k, v]) => [k, pick(v)]))
        : apiData;
    return result !== undefined ? JSON.stringify(result) : `No data found`;
  }

  return `No data found`;
}

export const databaseLookupTool = tool({
  name: "database_lookup",
  description:
    "Performs a lookup in the database to retrieve data. Supports single id, multiple ids (batch), or no id (returns all). Use fields parameter to return only specific fields per item. For catalog API, use asin/asins instead of id/ids.",
  inputSchema: z.object({
    api: z.enum(Api),
    id: z.string().optional(),
    ids: z.array(z.string()).optional(),
    asin: z.string().optional(),
    asins: z.array(z.string()).optional(),
    fields: z.array(z.string()).optional(),
  }),
  callback: databaseLookupCallback,
});
