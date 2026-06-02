import { Request, Response } from "express";
import { Agent } from "@strands-agents/sdk";
import z from "zod";
import { AgentDefinition, AGENTS_DEFINITIONS_REGISTRY } from "../agent-definition/agentsDefinitionsRegistry.js";
import { ResponseSchema } from "../schema/schemas.js";
import { validateRequest } from "../service/requestValidationService.js";
import { asyncLocalStorage } from "../index.js";
import { model } from "../modelProvider.js";
import { printMetricsAndTraces } from "../util.js";
import { handleAgentError } from "./errorHandler.js";

export const createResponse = async (request: Request, response: Response) => {
  await asyncLocalStorage.run({ accessToken: request.header("x-amz-access-token") }, async () => {
    const validation = await validateRequest(request);

    if (validation.valid) {
      const agentDefinition: AgentDefinition = AGENTS_DEFINITIONS_REGISTRY.get(validation.operationId);
      const responseGenerationAgent = new Agent({
        structuredOutputSchema: ResponseSchema,
        tools: agentDefinition.tools,
        model: model,
      });

      try {
        const responseResult = await responseGenerationAgent.invoke(agentDefinition.instructions(request, validation.result));
        printMetricsAndTraces(responseResult);

        const sandboxResponse = responseResult.structuredOutput as z.infer<typeof ResponseSchema>;
        if (sandboxResponse.body) {
          response.status(sandboxResponse.statusCode).json(JSON.parse(sandboxResponse.body)).send();
        } else response.status(sandboxResponse.statusCode).send();
      } catch (error) {
        handleAgentError(error, response);
      }
    } else {
      response.status(validation.statusCode!).json(validation.errors).send();
    }
  });
};
