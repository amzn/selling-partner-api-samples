import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { Operation } from "../../src/tools/code-generation-tools/models/operation";
import { Model } from "../../src/tools/code-generation-tools/models/model";
import { parseFilterString, filterByNames } from "../../src/utils/filtering";
import { PaginationUtils, PaginationParams } from "../../src/utils/pagination";

/**
 * Feature: code-generation-tools-filtering-enhancements
 * Property-based tests for DiscoveryService filtering
 */

describe("Property Tests: Filter-Then-Paginate Order", () => {
  /**
   * Property 9: Filter-Then-Paginate Order
   * Validates: Requirements 7.5
   *
   * For any operation list with filtering and pagination, the pagination totalItems count
   * should reflect the filtered count, not the original count, proving that filtering
   * is applied before pagination.
   */
  it("Property 9: pagination totalItems reflects filtered count, not original count", () => {
    fc.assert(
      fc.property(
        // Generate array of operations
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }),
            description: fc.string({ minLength: 1, maxLength: 50 }),
            callMethod: fc.constantFrom("GET", "POST", "PUT", "DELETE"),
            returnedModel: fc.string({ minLength: 1, maxLength: 20 }),
            rateLimit: fc.oneof(
              fc.constant(null),
              fc.record({
                requestsPerSecond: fc.integer({ min: 1, max: 100 }),
              }),
            ),
          }) as fc.Arbitrary<Operation>,
          { minLength: 5, maxLength: 50 },
        ),
        // Generate filter names (subset of operation names)
        fc.integer({ min: 1, max: 5 }),
        // Generate pagination params
        fc.record({
          page: fc.integer({ min: 1, max: 5 }),
          pageSize: fc.integer({ min: 1, max: 20 }),
        }) as fc.Arbitrary<PaginationParams>,
        (operations, filterCount, paginationParams) => {
          // Skip if we don't have enough operations
          if (operations.length === 0) {
            return true;
          }

          // Select some operation names to filter by
          const namesToFilter = operations
            .slice(0, Math.min(filterCount, operations.length))
            .map((op) => op.name);

          // Apply filtering first
          const filtered = filterByNames(operations, namesToFilter);

          // Then apply pagination
          const paginated = PaginationUtils.paginateArray(
            filtered,
            paginationParams,
          );

          // The totalItems should equal the filtered count, not the original count
          expect(paginated.pagination.totalItems).toBe(filtered.length);
          expect(paginated.pagination.totalItems).toBeLessThanOrEqual(
            operations.length,
          );

          // The items in the page should be from the filtered set
          expect(paginated.items.length).toBeLessThanOrEqual(filtered.length);
          expect(paginated.items.length).toBeLessThanOrEqual(
            paginationParams.pageSize || 10,
          );

          // All items in the page should be in the filtered set
          for (const item of paginated.items) {
            const isInFiltered = filtered.some((f) => f.name === item.name);
            expect(isInFiltered).toBe(true);
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 9: filter-then-paginate for models", () => {
    fc.assert(
      fc.property(
        // Generate array of models
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }),
            swaggerType: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 10 }),
              fc.string({ minLength: 1, maxLength: 10 }),
            ),
            attributeMap: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 10 }),
              fc.string({ minLength: 1, maxLength: 10 }),
            ),
            isEnum: fc.boolean(),
            enumValues: fc.option(
              fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
                minLength: 1,
                maxLength: 5,
              }),
              { nil: undefined },
            ),
          }) as fc.Arbitrary<Model>,
          { minLength: 5, maxLength: 50 },
        ),
        // Generate filter names (subset of model names)
        fc.integer({ min: 1, max: 5 }),
        // Generate pagination params
        fc.record({
          page: fc.integer({ min: 1, max: 5 }),
          pageSize: fc.integer({ min: 1, max: 20 }),
        }) as fc.Arbitrary<PaginationParams>,
        (models, filterCount, paginationParams) => {
          // Skip if we don't have enough models
          if (models.length === 0) {
            return true;
          }

          // Select some model names to filter by
          const namesToFilter = models
            .slice(0, Math.min(filterCount, models.length))
            .map((m) => m.name);

          // Apply filtering first
          const filtered = filterByNames(models, namesToFilter);

          // Then apply pagination
          const paginated = PaginationUtils.paginateArray(
            filtered,
            paginationParams,
          );

          // The totalItems should equal the filtered count, not the original count
          expect(paginated.pagination.totalItems).toBe(filtered.length);
          expect(paginated.pagination.totalItems).toBeLessThanOrEqual(
            models.length,
          );

          // The items in the page should be from the filtered set
          expect(paginated.items.length).toBeLessThanOrEqual(filtered.length);
          expect(paginated.items.length).toBeLessThanOrEqual(
            paginationParams.pageSize || 10,
          );

          // All items in the page should be in the filtered set
          for (const item of paginated.items) {
            const isInFiltered = filtered.some((f) => f.name === item.name);
            expect(isInFiltered).toBe(true);
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 9: without filtering, totalItems equals original count", () => {
    fc.assert(
      fc.property(
        // Generate array of operations
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }),
            description: fc.string({ minLength: 1, maxLength: 50 }),
            callMethod: fc.constantFrom("GET", "POST", "PUT", "DELETE"),
            returnedModel: fc.string({ minLength: 1, maxLength: 20 }),
            rateLimit: fc.constant(null),
          }) as fc.Arbitrary<Operation>,
          { minLength: 1, maxLength: 50 },
        ),
        // Generate pagination params
        fc.record({
          page: fc.integer({ min: 1, max: 5 }),
          pageSize: fc.integer({ min: 1, max: 20 }),
        }) as fc.Arbitrary<PaginationParams>,
        (operations, paginationParams) => {
          // No filtering - just pagination
          const paginated = PaginationUtils.paginateArray(
            operations,
            paginationParams,
          );

          // The totalItems should equal the original count
          expect(paginated.pagination.totalItems).toBe(operations.length);

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 9: filtering to zero items results in zero totalItems", () => {
    fc.assert(
      fc.property(
        // Generate array of operations
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }),
            description: fc.string({ minLength: 1, maxLength: 50 }),
            callMethod: fc.constantFrom("GET", "POST", "PUT", "DELETE"),
            returnedModel: fc.string({ minLength: 1, maxLength: 20 }),
            rateLimit: fc.constant(null),
          }) as fc.Arbitrary<Operation>,
          { minLength: 1, maxLength: 50 },
        ),
        // Generate pagination params
        fc.record({
          page: fc.integer({ min: 1, max: 5 }),
          pageSize: fc.integer({ min: 1, max: 20 }),
        }) as fc.Arbitrary<PaginationParams>,
        (operations, paginationParams) => {
          // Filter by a name that doesn't exist
          const nonExistentName =
            "NONEXISTENT_NAME_THAT_WILL_NEVER_MATCH_12345";
          const filtered = filterByNames(operations, [nonExistentName]);

          // Apply pagination
          const paginated = PaginationUtils.paginateArray(
            filtered,
            paginationParams,
          );

          // The totalItems should be zero
          expect(paginated.pagination.totalItems).toBe(0);
          expect(paginated.items).toHaveLength(0);

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 9: page calculation is based on filtered count", () => {
    fc.assert(
      fc.property(
        // Generate array of operations with unique names
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }),
            description: fc.string({ minLength: 1, maxLength: 50 }),
            callMethod: fc.constantFrom("GET", "POST", "PUT", "DELETE"),
            returnedModel: fc.string({ minLength: 1, maxLength: 20 }),
            rateLimit: fc.constant(null),
          }) as fc.Arbitrary<Operation>,
          { minLength: 10, maxLength: 30 },
        ),
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 2, max: 5 }),
        (operations, filterCount, pageSize) => {
          // Skip if we don't have enough operations
          if (operations.length < filterCount) {
            return true;
          }

          // Select some operation names to filter by
          const namesToFilter = operations
            .slice(0, filterCount)
            .map((op) => op.name);

          // Apply filtering first
          const filtered = filterByNames(operations, namesToFilter);

          // Apply pagination with page 1
          const page1 = PaginationUtils.paginateArray(filtered, {
            page: 1,
            pageSize,
          });

          // Calculate expected total pages based on filtered count
          const expectedTotalPages = Math.ceil(filtered.length / pageSize);

          expect(page1.pagination.totalPages).toBe(expectedTotalPages);
          expect(page1.pagination.totalItems).toBe(filtered.length);

          // If there are multiple pages, verify page 2 also uses filtered count
          if (expectedTotalPages > 1) {
            const page2 = PaginationUtils.paginateArray(filtered, {
              page: 2,
              pageSize,
            });
            expect(page2.pagination.totalPages).toBe(expectedTotalPages);
            expect(page2.pagination.totalItems).toBe(filtered.length);
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
