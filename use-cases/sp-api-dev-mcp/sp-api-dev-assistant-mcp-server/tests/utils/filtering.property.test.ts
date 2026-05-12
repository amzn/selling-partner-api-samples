import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { filterByNames, projectFields } from "../../src/utils/filtering";

/**
 * Feature: code-generation-tools-filtering-enhancements
 * Property-based tests for filtering utilities
 */

describe("Property Tests: Name Filtering", () => {
  /**
   * Property 1: Operations Name Filtering
   * Validates: Requirements 1.1, 1.2, 1.5
   *
   * For any list of operations and any comma-separated filter string,
   * when filtering by operation names, all returned operations should have
   * names that match (case-insensitive) at least one name in the filter string.
   */
  it("Property 1: all filtered items match at least one filter name (case-insensitive)", () => {
    fc.assert(
      fc.property(
        // Generate array of items with names
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }),
            id: fc.integer(),
          }),
          { minLength: 0, maxLength: 50 },
        ),
        // Generate array of filter names
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 1,
          maxLength: 10,
        }),
        (items, filterNames) => {
          const filtered = filterByNames(items, filterNames);

          // Every filtered item should match at least one filter name (case-insensitive)
          const lowerFilterNames = filterNames.map((name) =>
            name.toLowerCase(),
          );

          for (const item of filtered) {
            const matches = lowerFilterNames.includes(item.name.toLowerCase());
            expect(matches).toBe(true);
          }

          // Filtered array should be subset of original
          expect(filtered.length).toBeLessThanOrEqual(items.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 1: filtering with empty names array returns all items", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }),
            id: fc.integer(),
          }),
          { minLength: 0, maxLength: 50 },
        ),
        (items) => {
          const filtered = filterByNames(items, []);
          expect(filtered).toEqual(items);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 1: case-insensitive matching works for all case variations", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer(),
        (name, id) => {
          const items = [{ name, id }];

          // Test with lowercase filter
          const filteredLower = filterByNames(items, [name.toLowerCase()]);
          expect(filteredLower).toHaveLength(1);

          // Test with uppercase filter
          const filteredUpper = filterByNames(items, [name.toUpperCase()]);
          expect(filteredUpper).toHaveLength(1);

          // Test with exact case
          const filteredExact = filterByNames(items, [name]);
          expect(filteredExact).toHaveLength(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property Tests: Field Projection", () => {
  /**
   * Property 3: Operations Field Projection
   * Validates: Requirements 2.1, 2.2
   *
   * For any operation and any valid comma-separated field list,
   * when projecting fields, the returned object should contain
   * exactly the specified fields and no others.
   */
  it("Property 3: projected object contains exactly specified valid fields", () => {
    const validFields = ["name", "description", "id", "type", "value"];

    fc.assert(
      fc.property(
        // Generate an object with all valid fields plus some extra
        fc.record({
          name: fc.string(),
          description: fc.string(),
          id: fc.integer(),
          type: fc.string(),
          value: fc.integer(),
          extra1: fc.string(),
          extra2: fc.integer(),
        }),
        // Generate subset of valid fields to project
        fc.subarray(validFields, { minLength: 1 }),
        (item, fieldsToProject) => {
          const projected = projectFields(item, fieldsToProject, validFields);

          // Check that all requested fields are present
          for (const field of fieldsToProject) {
            expect(projected).toHaveProperty(field);
            expect(projected[field as keyof typeof projected]).toEqual(
              item[field as keyof typeof item],
            );
          }

          // Check that no extra fields are present
          const projectedKeys = Object.keys(projected);
          expect(projectedKeys).toHaveLength(fieldsToProject.length);

          for (const key of projectedKeys) {
            expect(fieldsToProject).toContain(key);
          }

          // Check that invalid fields are not included
          expect(projected).not.toHaveProperty("extra1");
          expect(projected).not.toHaveProperty("extra2");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 3: projecting with invalid fields excludes them", () => {
    const validFields = ["name", "id"];

    fc.assert(
      fc.property(
        fc.record({
          name: fc.string(),
          id: fc.integer(),
          extra: fc.string(),
        }),
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
          minLength: 1,
          maxLength: 5,
        }),
        (item, invalidFields) => {
          // Mix valid and invalid fields
          const fieldsToProject = ["name", ...invalidFields];
          const projected = projectFields(item, fieldsToProject, validFields);

          // Only valid fields should be present
          const projectedKeys = Object.keys(projected);
          for (const key of projectedKeys) {
            expect(validFields).toContain(key);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 3: empty field list results in empty object", () => {
    const validFields = ["name", "id", "type"];

    fc.assert(
      fc.property(
        fc.record({
          name: fc.string(),
          id: fc.integer(),
          type: fc.string(),
        }),
        (item) => {
          const projected = projectFields(item, [], validFields);
          expect(projected).toEqual({});
          expect(Object.keys(projected)).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
