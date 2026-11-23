import { tool } from "@strands-agents/sdk";
import { Api } from "../database/Context.js";
import { insertEntity } from "./dataGenerationCore.js";
import z from "zod";

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
    const result = insertEntity(input.api, input.id, input.entity as Record<string, unknown> | undefined);
    return Promise.resolve(result.ok ? "Success" : result.error);
  },
});
