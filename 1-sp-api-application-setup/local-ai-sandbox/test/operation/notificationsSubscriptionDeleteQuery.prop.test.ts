import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { Api, Context } from "../../src/database/Context.js";
import {
  createDestinationHandler,
  createSubscriptionHandler,
  deleteSubscriptionByIdHandler,
} from "../../src/operation/notificationsOperations.js";
import type { Request } from "express";

function makeValidationResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

describe("Property 6: Subscription delete-then-query", () => {
  beforeEach(() => {
    Context.reset();
  });

  it("deleting a subscription and then querying it returns 404 NotFound", async () => {
    /**
     * Validates: Requirements 4.12, 7.4, 8.4
     *
     * For any valid subscription created via createSubscription, calling deleteSubscriptionById
     * with the returned subscriptionId and then querying the database for that subscription
     * SHALL result in the document being absent (null), which is the condition that causes
     * the entityExistence validation rule to return a 404 NotFound response.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.option(
          fc.record({
            eventFilter: fc.option(
              fc.record({ marketplaceId: fc.string({ minLength: 1, maxLength: 20 }) }),
              { nil: undefined },
            ),
          }),
          { nil: undefined },
        ),
        async (processingDirective) => {
          // Reset for each run since notificationType + payloadVersion uniqueness constraint
          Context.reset();

          // Create a destination first
          const destResult = await createDestinationHandler(
            makeValidationResult({ operationId: "createDestination" }) as never,
            {
              body: {
                name: "prop-test-dest",
                resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:123456789012:test-queue" } },
              },
            } as unknown as Request,
          );
          expect(destResult.statusCode).toBe(200);
          const destinationId = ((destResult.data.body as Record<string, unknown>).payload as Record<string, unknown>).destinationId as string;

          // Build subscription request body
          const body: Record<string, unknown> = {
            payloadVersion: "1.0",
            destinationId,
          };
          if (processingDirective !== undefined) {
            body.processingDirective = processingDirective;
          }

          // Create subscription
          const createResult = await createSubscriptionHandler(
            makeValidationResult({
              operationId: "createSubscription",
              pathParams: { notificationType: "ORDER_CHANGE" },
            }) as never,
            { body } as unknown as Request,
          );
          expect(createResult.statusCode).toBe(200);
          const subscriptionId = ((createResult.data.body as Record<string, unknown>).payload as Record<string, unknown>).subscriptionId as string;

          // Delete subscription
          const deleteResult = await deleteSubscriptionByIdHandler(
            makeValidationResult({
              operationId: "deleteSubscriptionById",
              pathParams: { subscriptionId },
            }) as never,
            {} as unknown as Request,
          );
          expect(deleteResult.statusCode).toBe(200);

          // Verify the subscription is no longer in the database.
          // In the real request flow, the entityExistence validation rule would
          // look up the subscriptionId and return 404 "NotFound" when it's absent.
          const stored = Context.instance.engine.get(Api.NOTIFICATIONS, subscriptionId);
          expect(stored).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});
