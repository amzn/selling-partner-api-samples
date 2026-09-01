import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { DatabaseEngine } from "../../src/database/DatabaseEngine.js";
import { InvalidDomainError } from "../../src/database/types.js";
import { Api } from "../../src/database/Context.js";

const arbKey = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);
const arbDocument = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s !== "_key" && s !== "$loki" && s !== "meta" && s !== "__proto__"),
  fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
);
const arbDomain = fc.constantFrom(...Object.values(Api));
const arbInvalidDomain = fc.string({ minLength: 1 }).filter((s) => !Object.values(Api).includes(s as Api));

describe("DatabaseEngine Property-Based Tests", () => {
  let engine: DatabaseEngine;

  beforeEach(() => {
    engine = new DatabaseEngine({ mode: "memory" });
  });

  it("Property 1: Insert/Get Round-Trip", () => {
    fc.assert(
      fc.property(arbDomain, arbKey, arbDocument, (domain, key, document) => {
        engine.put(domain, key, document);
        const retrieved = engine.get(domain, key);
        expect(retrieved).not.toBeNull();
        const expected = { ...document, _key: key };
        expect(retrieved).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });

  it("Property 2: Get Non-Existent Key Returns Null", () => {
    fc.assert(
      fc.property(arbDomain, arbKey, (domain, key) => {
        const result = engine.get(domain, key);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("Property 3: Remove Makes Document Unretrievable", async () => {
    await fc.assert(
      fc.asyncProperty(arbDomain, arbKey, arbDocument, async (domain, key, document) => {
        engine.put(domain, key, document);
        await engine.remove(domain, key);
        const result = engine.get(domain, key);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("Property 4: Remove Non-Existent Key Succeeds", async () => {
    await fc.assert(
      fc.asyncProperty(arbDomain, arbKey, async (domain, key) => {
        const result = await engine.remove(domain, key);
        expect(result).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("Property 5: Batch Get Correctness", async () => {
    await fc.assert(
      fc.asyncProperty(arbDomain, fc.array(arbKey, { minLength: 1, maxLength: 10 }), arbDocument, async (domain, keys, document) => {
        // Insert documents for even-indexed keys only
        const insertedKeys = keys.filter((_, i) => i % 2 === 0);
        for (const key of insertedKeys) {
          engine.put(domain, key, document);
        }

        const batchResult = engine.getBatch(domain, keys);

        for (const key of keys) {
          if (insertedKeys.includes(key)) {
            expect(batchResult.get(key)).toEqual({ ...document, _key: key });
          } else {
            expect(batchResult.get(key)).toBeNull();
          }
        }

        // Clean up to avoid state leakage between iterations
        for (const key of insertedKeys) {
          await engine.remove(domain, key);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("Property 6: Collection Isolation", async () => {
    const domains = Object.values(Api);
    await fc.assert(
      fc.asyncProperty(arbKey, arbDocument, async (key, document) => {
        // Pick two distinct domains
        const domainA = domains[0];
        const domainB = domains[1];

        engine.put(domainA, key, document);

        // The other domain should not have this key
        const resultB = engine.get(domainB, key);
        expect(resultB).toBeNull();

        // Clean up for next iteration
        await engine.remove(domainA, key);
      }),
      { numRuns: 100 },
    );
  });

  it("Property 7: Invalid Domain Returns Error", async () => {
    await fc.assert(
      fc.asyncProperty(arbInvalidDomain, arbKey, arbDocument, async (domain, key, document) => {
        expect(() => engine.put(domain as Api, key, document)).toThrow(InvalidDomainError);
        expect(() => engine.get(domain as Api, key)).toThrow(InvalidDomainError);
        await expect(engine.remove(domain as Api, key)).rejects.toThrow(InvalidDomainError);
      }),
      { numRuns: 100 },
    );
  });
});
