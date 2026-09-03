import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { executeValidation } from "../../src/service/validationEngine.js";
import { QuantityLimitRule, RequestContext, ValidationFail, ValidationPipeline } from "../../src/validation/validationTypes.js";
import { VALIDATION_REGISTRY } from "../../src/validation/validationRegistry.js";
import { Context, Api } from "../../src/database/Context.js";
import { buildKey } from "../../src/registry/operationRegistry.js";

/**
 * Feature: orders-agent-definitions, Property 13: Quantity validation rejects quantities exceeding ordered amount
 *
 * For any `quantity` in the request body's `packageDetail.orderItems[]` that exceeds the
 * `quantityOrdered` of the corresponding order item in the resolved order entity, the
 * validation pipeline returns HTTP 400 with an "InvalidInput" error code.
 *
 * **Validates: Requirements 15.7**
 */
describe("Feature: orders-agent-definitions, Property 13: Quantity validation rejects quantities exceeding ordered amount", () => {
  const TEST_OPERATION_ID = "__test_quantityLimit__";
  const TEST_API_NAME = "TestOrders";
  const TEST_API_VERSION = "v1";

  const quantityLimitRule: QuantityLimitRule = {
    checkType: "quantityLimit",
    entityLabel: "order",
    failAction: {
      statusCode: 400,
      code: "InvalidInput",
      message: "Quantity exceeds the ordered quantity",
    },
  };

  it("Property 13: Quantity validation returns HTTP 400 with InvalidInput for any quantity exceeding quantityOrdered", async () => {
    // Generator for a positive quantityOrdered value
    const quantityOrderedArb = fc.integer({ min: 1, max: 10000 });

    // Generator for an orderItemId (non-empty, trimmed)
    const orderItemIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);

    // Generator for orderId (non-empty, unique per run, excluding prototype-polluting keys)
    const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype", "toString", "valueOf", "hasOwnProperty"]);
    const orderIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0 && !RESERVED_KEYS.has(s));

    const excessArb = fc.integer({ min: 1, max: 10000 });

    await fc.assert(
      fc.asyncProperty(quantityOrderedArb, orderItemIdArb, orderIdArb, excessArb, async (quantityOrdered, orderItemId, orderId, excess) => {
        // Generate a quantity that exceeds quantityOrdered (at least quantityOrdered + 1)
        const exceedingQuantity = quantityOrdered + excess;

        const validationKey = buildKey(TEST_API_NAME, TEST_API_VERSION, TEST_OPERATION_ID);

        // Set up pipeline: entityExistence (to resolve order into resolvedEntities) → quantityLimit
        VALIDATION_REGISTRY.set(validationKey, [
          {
            checkType: "entityExistence",
            entity: {
              api: Api.ORDERS,
              paramName: "orderId",
              paramSource: "path",
              entityLabel: "order",
            },
            failAction: {
              statusCode: 404,
              code: "NotFound",
              message: "Order not found",
            },
          },
          quantityLimitRule,
        ] as ValidationPipeline);

        // Insert test order with an orderItem having quantityOrdered
        Context.instance.engine.put(Api.ORDERS, orderId, {
          orderId,
          orderItems: [
            {
              orderItemId,
              quantityOrdered,
            },
          ],
        });

        try {
          const context: RequestContext = {
            apiName: TEST_API_NAME,
            apiVersion: TEST_API_VERSION,
            operationId: TEST_OPERATION_ID,
            method: "POST",
            pathParams: { orderId },
            queryParams: {},
            body: {
              packageDetail: {
                orderItems: [
                  {
                    orderItemId,
                    quantity: exceedingQuantity,
                  },
                ],
              },
            },
          };

          const result = await executeValidation(context);

          // Should fail: quantity exceeds quantityOrdered
          expect(result.pass).toBe(false);
          const failResult = result as ValidationFail;
          expect(failResult.statusCode).toBe(400);
          expect(failResult.body.errors).toHaveLength(1);
          expect(failResult.body.errors[0].code).toBe("InvalidInput");
        } finally {
          // Cleanup
          Context.instance.engine.remove(Api.ORDERS, orderId);
          VALIDATION_REGISTRY.delete(validationKey);
        }
      }),
      { numRuns: 100 },
    );
  });
});
