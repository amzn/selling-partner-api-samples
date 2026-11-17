import { describe, it, expect, beforeEach } from "vitest";
import { Context, Api } from "../../src/database/Context.js";
import { dbNamespaces } from "../../src/registry/operationRegistry.js";

/**
 * Task 2.1 — confirm the newly-added `Api.TRANSFERS` enum member stays in sync with the generated
 * operation registry. `Context` runs `assertEnumMatchesRegistry` in its constructor, so a divergence
 * between the enum and `dbNamespaces()` would throw at construction (Requirements 2.1, 2.2, 2.3).
 */
describe("Api.TRANSFERS registry consistency", () => {
  beforeEach(() => {
    Context.reset();
  });

  it("exposes a TRANSFERS enum member whose value is 'transfers'", () => {
    expect(Api.TRANSFERS).toBe("transfers");
  });

  it("includes 'transfers' in the registry namespaces", () => {
    expect(dbNamespaces()).toContain("transfers");
  });

  it("constructs Context without throwing from assertEnumMatchesRegistry", () => {
    expect(() => Context.instance).not.toThrow();
  });

  it("keeps the Api enum and registry namespaces fully in agreement on 'transfers'", () => {
    const enumValues = [...Object.values(Api)].sort();
    const registryValues = dbNamespaces();

    expect(enumValues).toContain("transfers");
    expect(registryValues).toContain("transfers");
    // The constructor's assertion requires exact set equality; prove it holds end-to-end.
    expect(registryValues).toEqual(enumValues);
  });
});
