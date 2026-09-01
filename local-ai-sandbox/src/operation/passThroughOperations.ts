import type { Request } from "express";
import type { OperationHandler } from "./operationTypes.js";

/**
 * Pass-through target backend type.
 * - "production": forwards to the real SP-API production endpoint
 * - "sandbox": forwards to the SP-API sandbox endpoint
 */
export type PassThroughTarget = "production" | "sandbox";

const region = process.env.REGION && ["NA", "EU", "FE"].includes(process.env.REGION) ? process.env.REGION : "NA";
export const PROD_BACKEND = `https://sellingpartnerapi-${region.toLowerCase()}.amazon.com`;
const SANDBOX_BACKEND = `https://sandbox.sellingpartnerapi-${region.toLowerCase()}.amazon.com`;

/**
 * Builds the target URL for a pass-through request.
 * Extracts the raw query string from the original URL to preserve repeated keys
 * (e.g., marketplaceIds=A&marketplaceIds=B) and original encoding.
 */
function buildTargetUrl(target: PassThroughTarget, request: Request): string {
  const backend = target === "production" ? PROD_BACKEND : SANDBOX_BACKEND;
  const queryString = request.originalUrl.split("?")[1] ?? "";
  return queryString ? `${backend}${request.path}?${queryString}` : `${backend}${request.path}`;
}

/**
 * Creates a generic pass-through operation handler that forwards the request
 * to the specified backend (production or sandbox) and returns the raw response.
 */
function createPassThroughHandler(target: PassThroughTarget): OperationHandler {
  return async (validationResult, request) => {
    const accessToken = request.header("x-amz-access-token");
    if (!accessToken) {
      return {
        statusCode: 401,
        operationId: validationResult.operationId,
        apiName: validationResult.apiName,
        apiVersion: validationResult.apiVersion,
        pathParams: validationResult.pathParams,
        queryParams: validationResult.queryParams,
        body: request.body as Record<string, unknown> | undefined,
        operation: validationResult.operation,
        resolvedEntities: validationResult.resolvedEntities,
        data: { body: { errors: [{ code: "Unauthorized", message: "Access token is missing or empty. Provide a valid x-amz-access-token header." }] } },
      };
    }

    const url = buildTargetUrl(target, request);
    const method = request.method;

    const headers: Record<string, string> = {
      "content-type": request.get("content-type") ?? "application/json",
      "x-amz-access-token": accessToken,
    };

    const userAgent = request.header("user-agent");
    if (userAgent) {
      headers["user-agent"] = userAgent;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (!["GET", "HEAD", "DELETE"].includes(method.toUpperCase()) && request.body) {
      fetchOptions.body = JSON.stringify(request.body);
    }

    console.log(`[PassThrough] ${method} ${url} → ${target}`);

    try {
      const response = await globalThis.fetch(url, fetchOptions);

      const text = await response.text();
      let responseBody: unknown;
      try {
        responseBody = text ? JSON.parse(text) : undefined;
      } catch {
        responseBody = { raw: text };
      }

      const FORWARDABLE_HEADERS = new Set(["x-amzn-ratelimit-limit", "x-amzn-requestid", "x-amz-request-id", "x-amzn-trace-id"]);

      const responseHeaders = new Map<string, string>();
      response.headers.forEach((value, key) => {
        if (FORWARDABLE_HEADERS.has(key.toLowerCase())) {
          responseHeaders.set(key, value);
        }
      });

      return {
        statusCode: response.status,
        operationId: validationResult.operationId,
        apiName: validationResult.apiName,
        apiVersion: validationResult.apiVersion,
        pathParams: validationResult.pathParams,
        queryParams: validationResult.queryParams,
        body: request.body as Record<string, unknown> | undefined,
        operation: validationResult.operation,
        resolvedEntities: validationResult.resolvedEntities,
        data: { body: responseBody, headers: responseHeaders },
      };
    } catch (error) {
      console.error("[PassThrough] Error proxying %s %s:", method, url, error);

      return {
        statusCode: 502,
        operationId: validationResult.operationId,
        apiName: validationResult.apiName,
        apiVersion: validationResult.apiVersion,
        pathParams: validationResult.pathParams,
        queryParams: validationResult.queryParams,
        body: request.body as Record<string, unknown> | undefined,
        operation: validationResult.operation,
        resolvedEntities: validationResult.resolvedEntities,
        data: { body: { errors: [{ code: "BadGateway", message: "Failed to proxy request to upstream service" }]}},
      };
    }
  };
}

export const productionPassThroughHandler = createPassThroughHandler("production");
export const sandboxPassThroughHandler = createPassThroughHandler("sandbox");
