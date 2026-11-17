import { Response } from "express";
import { ModelError, ModelThrottledError, ContextWindowOverflowError, MaxTokensError } from "@strands-agents/sdk";

export function handleAgentError(error: unknown, response: Response): void {
  if (error instanceof ModelError) {
    let statusCode = 500;
    let errorType = "ModelError";
    let errorMessage = error.message;

    if (error instanceof ModelThrottledError) {
      statusCode = 429;
      errorType = "ModelThrottledError";
      errorMessage = "The model is currently rate-limited. Please try again later.";
    } else if (error instanceof ContextWindowOverflowError) {
      statusCode = 400;
      errorType = "ContextWindowOverflowError";
      errorMessage = "The request is too large for the model's context window. Please reduce the input size.";
    } else if (error instanceof MaxTokensError) {
      statusCode = 500;
      errorType = "MaxTokensError";
      errorMessage = "The model reached its maximum token limit during generation. Please simplify your request.";
    }

    response.status(statusCode).json({
      error: errorMessage,
      errorType,
    });
  } else {
    response.status(500).json({
      error: error instanceof Error ? error.message : "An unexpected error occurred.",
      errorType: "UnexpectedError",
    });
  }
}
