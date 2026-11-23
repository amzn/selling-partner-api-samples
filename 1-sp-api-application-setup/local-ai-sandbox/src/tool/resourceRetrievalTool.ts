import { tool } from "@strands-agents/sdk";
import { Api } from "../database/Context.js";
import z from "zod";
import { retrieveModel } from "./dataGenerationCore.js";

export const resourceRetrievalTool = tool({
  name: "resource_retrieval",
  description: "Retrieves resources for a given Api",
  inputSchema: z.object({
    api: z.enum(Api),
  }),
  callback: (input) => {
    console.warn(`Model retrieval for api ${input.api}`);
    return retrieveModel(input.api) ?? "No model found";
  },
});
