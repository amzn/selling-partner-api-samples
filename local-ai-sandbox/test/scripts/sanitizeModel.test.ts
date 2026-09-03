import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { sanitizeModel } from "../../scripts/fetchModels.js";

/** Collect every property key appearing anywhere in a value (objects and nested arrays). */
function allKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) allKeys(v, acc);
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      acc.push(k);
      allKeys(v, acc);
    }
  }
  return acc;
}

describe("sanitizeModel", () => {
  it("removes examples and x-amzn-api-sandbox at any depth", () => {
    const input = {
      swagger: "2.0",
      "x-amzn-api-sandbox": { top: true },
      paths: {
        "/x": {
          get: {
            operationId: "getX",
            examples: { a: 1 },
            responses: { "200": { examples: { b: 2 }, "x-amzn-api-sandbox": { c: 3 }, example: { keep: true } } },
          },
        },
      },
    };
    const out = sanitizeModel(input) as Record<string, unknown>;
    const keys = allKeys(out);
    expect(keys).not.toContain("examples");
    expect(keys).not.toContain("x-amzn-api-sandbox");
  });

  it("preserves example (singular)", () => {
    const out = sanitizeModel({ responses: { "200": { example: { keep: true } } } });
    expect(allKeys(out)).toContain("example");
  });

  it("does not mutate its input", () => {
    const input = { examples: { a: 1 }, keep: 1 };
    sanitizeModel(input);
    expect(input).toEqual({ examples: { a: 1 }, keep: 1 });
  });

  it("removes example only when it is nested inside a stripped subtree", () => {
    // `example` inside `examples` is removed with its parent; a sibling `example` is kept.
    expect(allKeys(sanitizeModel({ examples: { example: 0 } }))).not.toContain("example");
    expect(allKeys(sanitizeModel({ example: 0, examples: { a: 1 } }))).toContain("example");
  });

  describe("properties", () => {
    it("output never contains the stripped keys and is idempotent", () => {
      fc.assert(
        fc.property(fc.object({ key: fc.oneof(fc.string(), fc.constantFrom("examples", "x-amzn-api-sandbox", "example", "operationId")) }), (obj) => {
          const once = sanitizeModel(obj);
          const keys = allKeys(once);
          expect(keys).not.toContain("examples");
          expect(keys).not.toContain("x-amzn-api-sandbox");
          // idempotent
          expect(sanitizeModel(once)).toEqual(once);
        }),
      );
    });
  });
});
