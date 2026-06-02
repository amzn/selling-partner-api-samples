import { tool } from "@strands-agents/sdk";
import { Api, Context } from "../database/Context.js";
import z from "zod";

export const databaseRemovalTool = tool({
  name: "database_removal",
  description: "Removes data from the database",
  inputSchema: z.object({
    api: z.enum(Api),
    id: z.string(),
  }),
  callback: async (input) => {
    console.warn(`Database removal for api ${input.api} id ${input.id}`);
    await Context.instance.db.read();
    const apiData = Context.instance.db.data[input.api];
    if (apiData?.[input.id]) {
      delete apiData[input.id];
      await Context.instance.db.write();

      return "Success";
    }

    return `No data to remove`;
  },
});
