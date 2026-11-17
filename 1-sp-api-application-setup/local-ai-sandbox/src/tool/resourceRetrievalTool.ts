import { tool } from "@strands-agents/sdk";
import { Api } from "../database/Context.js";
import z from "zod";
import * as fs from "node:fs";
import { getModelPath } from "../registry/operationRegistry.js";

export const resourceRetrievalTool = tool({
  name: "resource_retrieval",
  description: "Retrieves resources for a given Api",
  inputSchema: z.object({
    api: z.enum(Api),
  }),
  callback: (input) => {
    console.warn(`Model retrieval for api ${input.api}`);
    const path = getModelPath(input.api);
    return path ? fs.readFileSync(path, "utf8") : "No model found";
  },
});
