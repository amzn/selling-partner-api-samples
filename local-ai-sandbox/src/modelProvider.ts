import { BedrockModel } from "@strands-agents/sdk";

export const model = new BedrockModel({
  modelId: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
  temperature: 1.0,
  stream: false,
});
