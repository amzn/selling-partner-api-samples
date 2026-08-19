import { tool } from "@strands-agents/sdk";
import { Api, Context } from "../database/Context.js";
import z from "zod";

export const databaseInsertionTool = tool({
  name: "database_insertion",
  description: "Inserts data into the database",
  inputSchema: z.object({
    api: z.enum(Api),
    id: z.string(),
    entity: z.any(),
  }),
  callback: async (input) => {
    console.warn(`Database insertion for api ${input.api} id ${input.id}`);
    await Context.instance.db.read();
    const apiData = Context.instance.db.data[input.api];
    if (apiData) {
      apiData[input.id] = input.entity;
      await Context.instance.db.write();

      return "Success";
    }

    return `Invalid api specified`;
  },
});
