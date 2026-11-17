import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { Context, Api } from "../../src/database/Context.js";
import { createDestinationHandler, getDestinationHandler } from "../../src/operation/notificationsOperations.js";
import type { UnifiedValidationPass } from "../../src/validation/validationTypes.js";
import type { Request } from "express";

function makeValidationResult(overrides: Partial<UnifiedValidationPass> = {}): UnifiedValidationPass {
  return {
    pass: true,
    operationId: "testOp",
    apiName: "Notifications",
    apiVersion: "v1",
    pathParams: {},
    queryParams: {},
    body: undefined,
    operation: {},
    resolvedEntities: {},
    ...overrides,
  };
}

describe("Property 1: Destination create-then-get round trip", () => {
  beforeEach(() => {
    Context.reset();
  });

  // Feature: notifications-api, Property 1: Destination create-then-get round trip
  it("creating a destination and then getting it returns identical name and resource", async () => {
    /**
     * Validates: Requirements 3.1, 3.6, 7.1, 8.3
     *
     * For any valid destination name (1–256 characters) and valid SQS resource specification
     * (ARN matching the arn:aws:sqs:*:*:* pattern), creating a destination via createDestination
     * and then retrieving it via getDestination using the returned destinationId SHALL return
     * a destination object with identical name and resource fields.
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate random valid names (1-256 chars, printable ASCII excluding control chars)
        fc.string({ minLength: 1, maxLength: 256 }),
        // Generate random SQS ARN parts
        fc.tuple(
          fc.stringMatching(/^[a-z]{2}-[a-z]+-[0-9]$/), // region (e.g. us-east-1)
          fc.stringMatching(/^[0-9]{12}$/), // account id (12 digits)
          fc.stringMatching(/^[a-zA-Z0-9_-]{1,80}$/), // queue name
        ),
        async (name, [region, accountId, queueName]) => {
          Context.reset();
          const arn = `arn:aws:sqs:${region}:${accountId}:${queueName}`;
          const resourceSpecification = { sqs: { arn } };

          // Create
          const createResult = await createDestinationHandler(
            makeValidationResult({ operationId: "createDestination" }),
            { body: { name, resourceSpecification } } as unknown as Request,
          );

          expect(createResult.statusCode).toBe(200);
          const payload = (createResult.data.body as Record<string, unknown>).payload as Record<string, unknown>;
          const destinationId = payload.destinationId as string;

          // Get — simulate the resolved entity (as the entityExistence validation would do)
          const stored = Context.instance.engine.get(Api.NOTIFICATIONS, destinationId);
          const getResult = await getDestinationHandler(
            makeValidationResult({
              operationId: "getDestination",
              pathParams: { destinationId },
              resolvedEntities: { destination: stored! },
            }),
            {} as unknown as Request,
          );

          expect(getResult.statusCode).toBe(200);
          const getPayload = (getResult.data.body as Record<string, unknown>).payload as Record<string, unknown>;
          expect(getPayload.name).toBe(name);
          expect(getPayload.resource).toEqual(resourceSpecification);
        },
      ),
      { numRuns: 100 },
    );
  });
});
