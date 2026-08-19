import { z } from "zod";
import { tool } from "@strands-agents/sdk";
import { asyncLocalStorage } from "../index.js";

export const callSellingPartnerApiTool = tool({
  name: "http_request",
  description:
    "Makes HTTP requests to Amazons Selling Partner API. Supports GET, POST, PUT, DELETE, PATCH, HEAD, and OPTIONS methods. Returns response with status, headers, and body.",
  inputSchema: z.object({
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]),
    url: z.string().url(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().optional(),
    timeout: z.number().positive().optional(),
  }),
  callback: async (input) => {
    const { method, url, headers, body, timeout = 30 } = input;
    console.warn(`Call Selling Partner API with url ${url} and method ${method}`);

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort();
    }, timeout * 1000);

    try {
      // Build fetch options
      const fetchOptions: RequestInit = {
        method,
        signal: controller.signal,
      };

      // Only add headers and body if they are defined
      if (headers !== undefined) {
        const store: any = asyncLocalStorage.getStore();
        headers["x-amz-access-token"] = store.accessToken;
        fetchOptions.headers = headers;
      }
      if (body !== undefined) {
        fetchOptions.body = body;
      }

      // Make the fetch request
      const response = await globalThis.fetch(url, fetchOptions);

      // Clear the timeout
      globalThis.clearTimeout(timeoutId);

      // Get response body as text
      const responseBody = await response.text();

      // Convert headers to plain object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Check if response was successful
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${method} ${url}`);
      }

      // Return successful response as JSON-serializable object
      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
      };
    } catch (error) {
      // Clear timeout on error
      globalThis.clearTimeout(timeoutId);

      // Handle abort/timeout error
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${timeout} seconds: ${method} ${url}`);
      }

      // Re-throw other errors (network errors, HTTP errors, etc.)
      throw error;
    }
  },
});
