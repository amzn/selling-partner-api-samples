import { describe, it, expect, vi } from "vitest";
import { createResponse } from "../../src/controller/spapiController.js";
import * as requestValidationService from "../../src/service/requestValidationService.js";
import { AGENTS_DEFINITIONS_REGISTRY } from "../../src/agent-definition/agentsDefinitionsRegistry.js";
import { Agent } from "@strands-agents/sdk";

describe("spapiController", () => {
  it("renders valid validation errors without double-sending", async () => {
    vi.spyOn(requestValidationService, "validateRequest").mockResolvedValue({
      valid: false,
      statusCode: 400,
      errors: { errors: "Invalid request format" },
    } as any);

    const req: any = {
      path: "/invalid/route",
      method: "GET",
      header: () => undefined,
    };

    let statusCode: number | undefined;
    let jsonBody: any;
    let sendCalls = 0;

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
      send: () => {
        sendCalls++;
        return res;
      },
    };

    await createResponse(req, res);

    expect(statusCode).toBe(400);
    expect(jsonBody).toEqual({ errors: "Invalid request format" });
    // Expect no redundant .send() after .json()
    expect(sendCalls).toBe(0);
  });
});
