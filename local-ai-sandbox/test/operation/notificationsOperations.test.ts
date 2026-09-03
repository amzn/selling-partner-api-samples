import { describe, it, expect, beforeEach, vi } from "vitest";
import { Context, Api } from "../../src/database/Context.js";
import {
  createDestinationHandler,
  getDestinationsHandler,
  getDestinationHandler,
  deleteDestinationHandler,
  createSubscriptionHandler,
  getSubscriptionHandler,
  getSubscriptionByIdHandler,
  deleteSubscriptionByIdHandler,
} from "../../src/operation/notificationsOperations.js";
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

function makeRequest(body: Record<string, unknown> = {}): Request {
  return { body } as unknown as Request;
}

describe("notificationsOperations", () => {
  beforeEach(() => {
    Context.reset();
  });

  // --- createDestination ---

  describe("createDestinationHandler", () => {
    it("creates a destination with SQS resource successfully", async () => {
      const result = await createDestinationHandler(
        makeValidationResult({ operationId: "createDestination" }),
        makeRequest({
          name: "test-dest",
          resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:123456789:queue" } },
        }),
      );

      expect(result.statusCode).toBe(200);
      const payload = (result.data.body as Record<string, unknown>).payload as Record<string, unknown>;
      expect(payload.name).toBe("test-dest");
      expect(payload.destinationId).toBeDefined();
      expect(payload.resource).toEqual({ sqs: { arn: "arn:aws:sqs:us-east-1:123456789:queue" } });
    });

    it("returns 501 for EventBridge resource", async () => {
      const result = await createDestinationHandler(
        makeValidationResult({ operationId: "createDestination" }),
        makeRequest({
          name: "eb-dest",
          resourceSpecification: { eventBridge: { name: "my-bus", region: "us-east-1", accountId: "123" } },
        }),
      );

      expect(result.statusCode).toBe(501);
      const body = result.data.body as { errors: Array<{ code: string }> };
      expect(body.errors[0].code).toBe("NotImplemented");
    });

    it("returns 400 for invalid resource specification (no sqs or eventBridge)", async () => {
      const result = await createDestinationHandler(
        makeValidationResult({ operationId: "createDestination" }),
        makeRequest({
          name: "bad-dest",
          resourceSpecification: {},
        }),
      );

      expect(result.statusCode).toBe(400);
      const body = result.data.body as { errors: Array<{ code: string }> };
      expect(body.errors[0].code).toBe("InvalidInput");
    });

    it("returns 409 when creating a destination with a duplicate name", async () => {
      // Create first destination
      await createDestinationHandler(
        makeValidationResult({ operationId: "createDestination" }),
        makeRequest({
          name: "duplicate-name",
          resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:123456789:queue1" } },
        }),
      );

      // Attempt to create another with the same name — the handler enforces
      // name uniqueness itself (mirroring the notificationType + payloadVersion
      // uniqueness check in createSubscriptionHandler), so this must be rejected.
      const result = await createDestinationHandler(
        makeValidationResult({ operationId: "createDestination" }),
        makeRequest({
          name: "duplicate-name",
          resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:123456789:queue2" } },
        }),
      );

      expect(result.statusCode).toBe(409);
      const body = result.data.body as { errors: Array<{ code: string; message: string }> };
      expect(body.errors[0].code).toBe("Conflict");
      expect(body.errors[0].message).toContain("duplicate-name");
    });
  });

  // --- getDestinations ---

  describe("getDestinationsHandler", () => {
    it("returns empty array when no destinations exist", async () => {
      const result = await getDestinationsHandler(makeValidationResult({ operationId: "getDestinations" }), {} as unknown as Request);

      expect(result.statusCode).toBe(200);
      const body = result.data.body as { payload: unknown[] };
      expect(body.payload).toEqual([]);
    });

    it("returns multiple destinations", async () => {
      // Create two destinations directly
      await createDestinationHandler(
        makeValidationResult({ operationId: "createDestination" }),
        makeRequest({ name: "dest-1", resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:111:q1" } } }),
      );
      await createDestinationHandler(
        makeValidationResult({ operationId: "createDestination" }),
        makeRequest({ name: "dest-2", resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:222:q2" } } }),
      );

      const result = await getDestinationsHandler(makeValidationResult({ operationId: "getDestinations" }), {} as unknown as Request);

      expect(result.statusCode).toBe(200);
      const body = result.data.body as { payload: unknown[] };
      expect(body.payload).toHaveLength(2);
    });
  });

  // --- getDestination ---

  describe("getDestinationHandler", () => {
    it("returns a destination from resolvedEntities", async () => {
      const destination = {
        _key: "dest-123",
        _type: "destination",
        destinationId: "dest-123",
        name: "my-dest",
        resource: { sqs: { arn: "arn:aws:sqs:us-east-1:123:queue" } },
      };

      const result = await getDestinationHandler(
        makeValidationResult({
          operationId: "getDestination",
          pathParams: { destinationId: "dest-123" },
          resolvedEntities: { destination },
        }),
        {} as unknown as Request,
      );

      expect(result.statusCode).toBe(200);
      const payload = (result.data.body as Record<string, unknown>).payload as Record<string, unknown>;
      expect(payload.destinationId).toBe("dest-123");
      expect(payload.name).toBe("my-dest");
      expect(payload).not.toHaveProperty("_key");
      expect(payload).not.toHaveProperty("_type");
    });
  });

  // --- deleteDestination ---

  describe("deleteDestinationHandler", () => {
    it("deletes a destination with no subscriptions referencing it", async () => {
      // Create a destination
      const createResult = await createDestinationHandler(
        makeValidationResult({ operationId: "createDestination" }),
        makeRequest({ name: "to-delete", resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:123:q" } } }),
      );
      const destId = ((createResult.data.body as Record<string, unknown>).payload as Record<string, unknown>).destinationId as string;

      const result = await deleteDestinationHandler(
        makeValidationResult({
          operationId: "deleteDestination",
          pathParams: { destinationId: destId },
          resolvedEntities: { destination: { _key: destId, destinationId: destId } },
        }),
        {} as unknown as Request,
      );

      expect(result.statusCode).toBe(200);
    });

    it("returns 409 when active subscriptions exist for the destination", async () => {
      // Create a destination
      const createResult = await createDestinationHandler(
        makeValidationResult({ operationId: "createDestination" }),
        makeRequest({ name: "dest-with-sub", resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:123:q" } } }),
      );
      const destId = ((createResult.data.body as Record<string, unknown>).payload as Record<string, unknown>).destinationId as string;

      // Create a subscription referencing the destination
      await createSubscriptionHandler(
        makeValidationResult({
          operationId: "createSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
        }),
        makeRequest({ payloadVersion: "1.0", destinationId: destId }),
      );

      // Try to delete the destination
      const result = await deleteDestinationHandler(
        makeValidationResult({
          operationId: "deleteDestination",
          pathParams: { destinationId: destId },
          resolvedEntities: { destination: { _key: destId, destinationId: destId } },
        }),
        {} as unknown as Request,
      );

      expect(result.statusCode).toBe(409);
      const body = result.data.body as { errors: Array<{ code: string }> };
      expect(body.errors[0].code).toBe("Conflict");
    });
  });

  // --- createSubscription ---

  describe("createSubscriptionHandler", () => {
    let destinationId: string;

    beforeEach(async () => {
      const createResult = await createDestinationHandler(
        makeValidationResult({ operationId: "createDestination" }),
        makeRequest({ name: "sub-test-dest", resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:123:q" } } }),
      );
      destinationId = ((createResult.data.body as Record<string, unknown>).payload as Record<string, unknown>).destinationId as string;
    });

    it("creates a subscription successfully", async () => {
      const result = await createSubscriptionHandler(
        makeValidationResult({
          operationId: "createSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
        }),
        makeRequest({ payloadVersion: "1.0", destinationId }),
      );

      expect(result.statusCode).toBe(200);
      const payload = (result.data.body as Record<string, unknown>).payload as Record<string, unknown>;
      expect(payload.subscriptionId).toBeDefined();
      expect(payload.notificationType).toBe("ORDER_CHANGE");
      expect(payload.payloadVersion).toBe("1.0");
      expect(payload.destinationId).toBe(destinationId);
    });

    it("returns 400 for unsupported notificationType", async () => {
      const result = await createSubscriptionHandler(
        makeValidationResult({
          operationId: "createSubscription",
          pathParams: { notificationType: "INVALID_TYPE" },
        }),
        makeRequest({ payloadVersion: "1.0", destinationId }),
      );

      expect(result.statusCode).toBe(400);
      const body = result.data.body as { errors: Array<{ code: string; message: string }> };
      expect(body.errors[0].code).toBe("InvalidInput");
      expect(body.errors[0].message).toContain("INVALID_TYPE");
    });

    it("returns 400 for unsupported payloadVersion", async () => {
      const result = await createSubscriptionHandler(
        makeValidationResult({
          operationId: "createSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
        }),
        makeRequest({ payloadVersion: "2.0", destinationId }),
      );

      expect(result.statusCode).toBe(400);
      const body = result.data.body as { errors: Array<{ code: string; message: string }> };
      expect(body.errors[0].code).toBe("InvalidInput");
      expect(body.errors[0].message).toContain("2.0");
    });

    it("returns 409 for duplicate subscription (same notificationType + payloadVersion)", async () => {
      // First create succeeds
      await createSubscriptionHandler(
        makeValidationResult({
          operationId: "createSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
        }),
        makeRequest({ payloadVersion: "1.0", destinationId }),
      );

      // Second create with same type + version should fail
      const result = await createSubscriptionHandler(
        makeValidationResult({
          operationId: "createSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
        }),
        makeRequest({ payloadVersion: "1.0", destinationId }),
      );

      expect(result.statusCode).toBe(409);
      const body = result.data.body as { errors: Array<{ code: string }> };
      expect(body.errors[0].code).toBe("Conflict");
    });

    it("returns 400 for notificationType not available in current mode", async () => {
      // createSubscriptionHandler reads the canonical CURRENT_MODE constant (resolved once at
      // module load) rather than process.env.MODE directly, so exercising the "wrong mode" path
      // requires mocking that constant and re-importing the module under a fresh module registry.
      vi.resetModules();
      vi.doMock("../../src/registry/operationRegistry.js", async () => {
        const actual = await vi.importActual<typeof import("../../src/registry/operationRegistry.js")>("../../src/registry/operationRegistry.js");
        return { ...actual, CURRENT_MODE: "Vendor" };
      });

      try {
        const vendorModeOps = await import("../../src/operation/notificationsOperations.js");

        const vendorDestResult = await vendorModeOps.createDestinationHandler(
          makeValidationResult({ operationId: "createDestination" }),
          makeRequest({ name: "vendor-mode-dest", resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:123:q" } } }),
        );
        const vendorDestId = ((vendorDestResult.data.body as Record<string, unknown>).payload as Record<string, unknown>).destinationId as string;

        const result = await vendorModeOps.createSubscriptionHandler(
          makeValidationResult({
            operationId: "createSubscription",
            pathParams: { notificationType: "ORDER_CHANGE" },
          }),
          makeRequest({ payloadVersion: "1.0", destinationId: vendorDestId }),
        );

        expect(result.statusCode).toBe(400);
        const body = result.data.body as { errors: Array<{ code: string; message: string }> };
        expect(body.errors[0].code).toBe("InvalidInput");
        expect(body.errors[0].message).toContain("Vendor");
      } finally {
        vi.doUnmock("../../src/registry/operationRegistry.js");
        vi.resetModules();
      }
    });

    it("returns 400 for missing payloadVersion", async () => {
      const result = await createSubscriptionHandler(
        makeValidationResult({
          operationId: "createSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
        }),
        makeRequest({ destinationId }),
      );

      expect(result.statusCode).toBe(400);
      const body = result.data.body as { errors: Array<{ code: string; message: string }> };
      expect(body.errors[0].code).toBe("InvalidInput");
      expect(body.errors[0].message).toContain("payloadVersion");
    });

    it("returns 400 for missing destinationId", async () => {
      const result = await createSubscriptionHandler(
        makeValidationResult({
          operationId: "createSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
        }),
        makeRequest({ payloadVersion: "1.0" }),
      );

      expect(result.statusCode).toBe(400);
      const body = result.data.body as { errors: Array<{ code: string; message: string }> };
      expect(body.errors[0].code).toBe("InvalidInput");
      expect(body.errors[0].message).toContain("destinationId");
    });
  });

  // --- getSubscription ---

  describe("getSubscriptionHandler", () => {
    let destinationId: string;

    beforeEach(async () => {
      const createResult = await createDestinationHandler(
        makeValidationResult({ operationId: "createDestination" }),
        makeRequest({ name: "get-sub-dest", resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:123:q" } } }),
      );
      destinationId = ((createResult.data.body as Record<string, unknown>).payload as Record<string, unknown>).destinationId as string;
    });

    it("returns subscription for a given notificationType (latest version)", async () => {
      await createSubscriptionHandler(
        makeValidationResult({
          operationId: "createSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
        }),
        makeRequest({ payloadVersion: "1.0", destinationId }),
      );

      const result = await getSubscriptionHandler(
        makeValidationResult({
          operationId: "getSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
          queryParams: {},
        }),
        {} as unknown as Request,
      );

      expect(result.statusCode).toBe(200);
      const payload = (result.data.body as Record<string, unknown>).payload as Record<string, unknown>;
      expect(payload.notificationType).toBe("ORDER_CHANGE");
      expect(payload.payloadVersion).toBe("1.0");
    });

    it("returns subscription filtered by specific payloadVersion query param", async () => {
      await createSubscriptionHandler(
        makeValidationResult({
          operationId: "createSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
        }),
        makeRequest({ payloadVersion: "1.0", destinationId }),
      );

      const result = await getSubscriptionHandler(
        makeValidationResult({
          operationId: "getSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
          queryParams: { payloadVersion: "1.0" },
        }),
        {} as unknown as Request,
      );

      expect(result.statusCode).toBe(200);
      const payload = (result.data.body as Record<string, unknown>).payload as Record<string, unknown>;
      expect(payload.payloadVersion).toBe("1.0");
    });

    it("returns 404 when no subscription exists for the notificationType", async () => {
      const result = await getSubscriptionHandler(
        makeValidationResult({
          operationId: "getSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
          queryParams: {},
        }),
        {} as unknown as Request,
      );

      expect(result.statusCode).toBe(404);
      const body = result.data.body as { errors: Array<{ code: string }> };
      expect(body.errors[0].code).toBe("NotFound");
    });
  });

  // --- getSubscriptionById ---

  describe("getSubscriptionByIdHandler", () => {
    it("returns a subscription from resolvedEntities", async () => {
      const subscription = {
        _key: "sub-456",
        _type: "subscription",
        subscriptionId: "sub-456",
        notificationType: "ORDER_CHANGE",
        payloadVersion: "1.0",
        destinationId: "dest-789",
      };

      const result = await getSubscriptionByIdHandler(
        makeValidationResult({
          operationId: "getSubscriptionById",
          pathParams: { subscriptionId: "sub-456" },
          resolvedEntities: { subscription },
        }),
        {} as unknown as Request,
      );

      expect(result.statusCode).toBe(200);
      const payload = (result.data.body as Record<string, unknown>).payload as Record<string, unknown>;
      expect(payload.subscriptionId).toBe("sub-456");
      expect(payload.notificationType).toBe("ORDER_CHANGE");
      expect(payload).not.toHaveProperty("_key");
      expect(payload).not.toHaveProperty("_type");
    });
  });

  // --- deleteSubscriptionById ---

  describe("deleteSubscriptionByIdHandler", () => {
    it("deletes a subscription successfully", async () => {
      // Create a destination and subscription first
      const destResult = await createDestinationHandler(
        makeValidationResult({ operationId: "createDestination" }),
        makeRequest({ name: "del-sub-dest", resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:123:q" } } }),
      );
      const destId = ((destResult.data.body as Record<string, unknown>).payload as Record<string, unknown>).destinationId as string;

      const subResult = await createSubscriptionHandler(
        makeValidationResult({
          operationId: "createSubscription",
          pathParams: { notificationType: "ORDER_CHANGE" },
        }),
        makeRequest({ payloadVersion: "1.0", destinationId: destId }),
      );
      const subId = ((subResult.data.body as Record<string, unknown>).payload as Record<string, unknown>).subscriptionId as string;

      const result = await deleteSubscriptionByIdHandler(
        makeValidationResult({
          operationId: "deleteSubscriptionById",
          pathParams: { subscriptionId: subId },
        }),
        {} as unknown as Request,
      );

      expect(result.statusCode).toBe(200);
      expect(result.data.body).toEqual({});
    });
  });
});
