import { Request, Response } from "express";
import { Agent } from "@strands-agents/sdk";
import { ResponseSchema } from "../schema/schemas.js";
import z from "zod";
import { databaseInsertionTool } from "../tool/databaseInsertionTool.js";
import { resourceRetrievalTool } from "../tool/resourceRetrievalTool.js";
import { guidanceRetrievalTool } from "../tool/domainGuidance.js";
import { model } from "../modelProvider.js";
import { printMetricsAndTraces } from "../util.js";
import { handleAgentError } from "./errorHandler.js";

export const generateData = async (request: Request, response: Response) => {
  const dataGenerationAgent = new Agent({
    structuredOutputSchema: ResponseSchema,
    tools: [resourceRetrievalTool, guidanceRetrievalTool, databaseInsertionTool],
    model: model,
  });

  const prompt = `
        You are a test data generation assistant. Evaluate user requests and generate data when appropriate.
        
        PROCESS
        Step 1: Determine if the user prompt requests test data generation
        Step 2: 
        Valid request: Identify the target Api, retrieve its resources with resource_retrieval
          AND its sandbox-specific guidance with guidance_retrieval, generate test data that follows
          both, ensure generated data validates against the schema, write to database, and confirm
          success with a brief message
        Invalid request: Provide a concise explanation of why the request cannot be fulfilled
        
        RESPONSE FORMAT
        Success: Short confirmation message indicating data was generated and saved; status code: 200
        Failure: Brief, actionable error message explaining the issue; status code: 400
        
        CONTEXT
        Prompt: ${request.body.prompt}
        
        ADDITIONAL INFORMATION:
        - The raw API model describes the API response shape, not the sandbox's stored document shape.
          Before generating, ALWAYS call guidance_retrieval for the target Api: where the two differ,
          the guidance is authoritative. If it reports no guidance, the API model shape is enough.
        - id passed to databaseInsertionTool must match entity id and pass schema validation, return error if not
    `;

  try {
    const responseResult = await dataGenerationAgent.invoke(prompt);
    printMetricsAndTraces(responseResult);

    const dataGenerationResponse = responseResult.structuredOutput as z.infer<typeof ResponseSchema>;
    response.status(dataGenerationResponse.statusCode).json({ result: dataGenerationResponse.body }).send();
  } catch (error) {
    handleAgentError(error, response);
  }
};
