import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  BaseParser,
  RateLimitEntry,
} from "../../src/tools/code-generation-tools/parsers/base-parser.js";
import {
  Category,
  Operation,
  Model,
  RateLimit,
} from "../../src/tools/code-generation-tools/models/index.js";
import { FileSystemUtils } from "../../src/utils/file-system.js";
import { stringify as yamlStringify } from "yaml";

/**
 * Concrete test implementation of BaseParser to test protected methods
 */
class TestParser extends BaseParser {
  constructor(repositoryPath: string = "/test/repo") {
    super(repositoryPath, "test");
  }

  // Expose the protected extractRateLimit method for testing
  public testExtractRateLimit(content: string, methodName?: string) {
    return this.extractRateLimit(content, methodName);
  }

  // Expose the protected loadRateLimitMap method for testing
  public testLoadRateLimitMap(): Promise<Map<string, RateLimitEntry>> {
    return this.loadRateLimitMap();
  }

  // Expose the protected lookupRateLimit method for testing
  public testLookupRateLimit(
    className: string,
    methodName: string,
  ): Promise<RateLimit | null> {
    return this.lookupRateLimit(className, methodName);
  }

  // Reset the cached rateLimitMap for test isolation
  public resetCache(): void {
    (this as any).rateLimitMap = null;
  }

  // Implement abstract methods (not used in these tests)
  async parseCategories(): Promise<Category[]> {
    return [];
  }

  async parseOperations(filePath: string): Promise<Operation[]> {
    return [];
  }

  async parseModels(directoryPath: string): Promise<Model[]> {
    return [];
  }

  async parseBasicUsage(): Promise<any> {
    return {};
  }
}

describe("BaseParser - extractRateLimit", () => {
  const parser = new TestParser();

  describe("Python documentation format", () => {
    it('should extract rate limit from Python docstring with "per second"', () => {
      const content = `
        def get_order(self, order_id):
            """
            Get order details
            Rate limit: 0.5 requests per second
            """
      `;
      const result = parser.testExtractRateLimit(content, "get_order");
      expect(result).toEqual({ requestsPerSecond: 0.5 });
    });

    it('should extract rate limit from Python docstring with "per minute"', () => {
      const content = `
        def list_orders(self):
            """
            List all orders
            Rate limit: 30 requests per minute
            """
      `;
      const result = parser.testExtractRateLimit(content, "list_orders");
      expect(result).toEqual({ requestsPerMinute: 30 });
    });

    it("should handle integer rate limits", () => {
      const content = `
        """
        Rate limit: 10 requests per second
        """
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerSecond: 10 });
    });
  });

  describe("Java documentation format", () => {
    it("should extract rate limit from Java annotation style", () => {
      const content = `
        /**
         * Get order details
         * @rateLimit 0.5 requests/second
         */
        public Order getOrder(String orderId)
      `;
      const result = parser.testExtractRateLimit(content, "getOrder");
      expect(result).toEqual({ requestsPerSecond: 0.5 });
    });

    it("should extract rate limit with @rateLimit and per minute", () => {
      const content = `
        /**
         * @rateLimit 45 requests/minute
         */
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerMinute: 45 });
    });
  });

  describe("JavaScript documentation format", () => {
    it("should extract rate limit from JSDoc style", () => {
      const content = `
        /**
         * Get order details
         * Rate: 0.5/second
         */
        function getOrder(orderId) {
      `;
      const result = parser.testExtractRateLimit(content, "getOrder");
      expect(result).toEqual({ requestsPerSecond: 0.5 });
    });

    it("should extract rate limit with abbreviated format", () => {
      const content = `
        // Rate: 2.5 req/s
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerSecond: 2.5 });
    });

    it("should extract rate limit with req/min format", () => {
      const content = `
        // Rate: 120 req/min
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerMinute: 120 });
    });
  });

  describe("Alternative formats", () => {
    it('should extract rate limit with "Throttling" keyword', () => {
      const content = `
        Throttling: 0.5 per second
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerSecond: 0.5 });
    });

    it('should extract rate limit with "Throttle" keyword', () => {
      const content = `
        Throttle: 25 requests per minute
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerMinute: 25 });
    });

    it("should handle abbreviated units (sec)", () => {
      const content = `
        Rate limit: 1.5 req/sec
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerSecond: 1.5 });
    });

    it("should handle abbreviated units (m)", () => {
      const content = `
        Rate: 60 req/m
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerMinute: 60 });
    });
  });

  describe("Missing rate limit information", () => {
    it("should return null when no rate limit is present", () => {
      const content = `
        def get_order(self, order_id):
            """
            Get order details
            No rate limit information here
            """
      `;
      const result = parser.testExtractRateLimit(content, "get_order");
      expect(result).toBeNull();
    });

    it("should return null for empty content", () => {
      const result = parser.testExtractRateLimit("");
      expect(result).toBeNull();
    });

    it("should return null when content has no documentation", () => {
      const content = `
        function getOrder(orderId) {
          return api.get('/orders/' + orderId);
        }
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toBeNull();
    });
  });

  describe("Malformed rate limit strings", () => {
    it("should return null for negative rate limit", () => {
      const content = `
        Rate limit: -0.5 requests per second
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toBeNull();
    });

    it("should return null for zero rate limit", () => {
      const content = `
        Rate limit: 0 requests per second
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toBeNull();
    });

    it("should return null for non-numeric rate limit", () => {
      const content = `
        Rate limit: many requests per second
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toBeNull();
    });

    it("should return null for incomplete rate limit string", () => {
      const content = `
        Rate limit: 0.5
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toBeNull();
    });

    it("should return null for rate limit with invalid unit", () => {
      const content = `
        Rate limit: 0.5 requests per hour
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toBeNull();
    });
  });

  describe("Case insensitivity", () => {
    it("should handle uppercase RATE LIMIT", () => {
      const content = `
        RATE LIMIT: 0.5 REQUESTS PER SECOND
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerSecond: 0.5 });
    });

    it("should handle mixed case Rate Limit", () => {
      const content = `
        Rate Limit: 30 Requests Per Minute
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerMinute: 30 });
    });
  });

  describe("Edge cases", () => {
    it("should extract first rate limit when multiple are present", () => {
      const content = `
        Rate limit: 0.5 requests per second
        Also rate limit: 30 requests per minute
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerSecond: 0.5 });
    });

    it("should handle rate limit with extra whitespace", () => {
      const content = `
        Rate   limit  :   0.5   requests   per   second
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerSecond: 0.5 });
    });

    it("should handle decimal rate limits with multiple decimal places", () => {
      const content = `
        Rate limit: 0.125 requests per second
      `;
      const result = parser.testExtractRateLimit(content);
      expect(result).toEqual({ requestsPerSecond: 0.125 });
    });
  });
});

// ============================================================================
// YAML Loading and Lookup Tests
// ============================================================================

/** Arbitrary for positive finite numbers suitable for rate limit values */
const positiveNum = fc.double({
  min: 0.001,
  max: 1e4,
  noNaN: true,
  noDefaultInfinity: true,
});

/** Arbitrary for alphanumeric non-empty strings (class/method names) */
const alphanumStr = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => /^[a-zA-Z0-9]+$/.test(s));

/**
 * Mirrors the method-name normalization performed by lookupRateLimit:
 * snake_case → camelCase, then lowercase the first character.
 */
function normalizeMethodName(methodName: string): string {
  const camel = methodName.replace(/_([a-z])/g, (_, c: string) =>
    c.toUpperCase(),
  );
  return camel.charAt(0).toLowerCase() + camel.slice(1);
}

describe("BaseParser - loadRateLimitMap", () => {
  let parser: TestParser;

  beforeEach(() => {
    parser = new TestParser("/test/repo");
    vi.restoreAllMocks();
  });

  it("should return empty map when file does not exist", async () => {
    vi.spyOn(FileSystemUtils, "fileExists").mockResolvedValue(false);

    const map = await parser.testLoadRateLimitMap();
    expect(map.size).toBe(0);
  });

  it("should cache result on second call (file read only once)", async () => {
    const yamlContent = "TestApi-getItem:\n  - 5\n  - 10\n";
    const fileExistsSpy = vi
      .spyOn(FileSystemUtils, "fileExists")
      .mockResolvedValue(true);
    const readFileSpy = vi
      .spyOn(FileSystemUtils, "readFile")
      .mockResolvedValue(yamlContent);

    const map1 = await parser.testLoadRateLimitMap();
    const map2 = await parser.testLoadRateLimitMap();

    expect(map1).toBe(map2);
    expect(fileExistsSpy).toHaveBeenCalledTimes(1);
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });

  /**
   * Property 3: YAML entry parsing round-trip
   *
   * For any valid YAML entry with a string key and array of 2 positive numbers
   * [rate, burst] or 3 positive numbers [rate, burst, interval], parsing should
   * produce a RateLimitEntry with correct values (interval defaults to 1 when absent).
   *
   * **Validates: Requirements 2.2, 2.3**
   */
  describe("Property 3: YAML entry parsing round-trip", () => {
    it("should correctly parse 2-element entries with default interval of 1", async () => {
      await fc.assert(
        fc.asyncProperty(
          alphanumStr,
          positiveNum,
          positiveNum,
          async (key, rate, burst) => {
            const parser = new TestParser("/test/repo");
            const yamlObj: Record<string, number[]> = {};
            yamlObj[key] = [rate, burst];
            const yamlContent = yamlStringify(yamlObj);

            vi.spyOn(FileSystemUtils, "fileExists").mockResolvedValue(true);
            vi.spyOn(FileSystemUtils, "readFile").mockResolvedValue(
              yamlContent,
            );

            const map = await parser.testLoadRateLimitMap();
            const entry = map.get(key);

            expect(entry).toBeDefined();
            expect(entry!.rate).toBe(rate);
            expect(entry!.burst).toBe(burst);
            expect(entry!.intervalInSeconds).toBe(1);

            vi.restoreAllMocks();
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should correctly parse 3-element entries with explicit interval", async () => {
      await fc.assert(
        fc.asyncProperty(
          alphanumStr,
          positiveNum,
          positiveNum,
          positiveNum,
          async (key, rate, burst, interval) => {
            const parser = new TestParser("/test/repo");
            const yamlObj: Record<string, number[]> = {};
            yamlObj[key] = [rate, burst, interval];
            const yamlContent = yamlStringify(yamlObj);

            vi.spyOn(FileSystemUtils, "fileExists").mockResolvedValue(true);
            vi.spyOn(FileSystemUtils, "readFile").mockResolvedValue(
              yamlContent,
            );

            const map = await parser.testLoadRateLimitMap();
            const entry = map.get(key);

            expect(entry).toBeDefined();
            expect(entry!.rate).toBe(rate);
            expect(entry!.burst).toBe(burst);
            expect(entry!.intervalInSeconds).toBe(interval);

            vi.restoreAllMocks();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 4: Malformed entries are skipped, valid entries preserved
   *
   * For any YAML content with a mix of valid entries (arrays of 2-3 positive numbers)
   * and malformed entries (non-arrays, wrong length, non-numeric), the resulting map
   * should contain exactly the valid entries.
   *
   * **Validates: Requirements 2.5**
   */
  describe("Property 4: Malformed entries are skipped, valid entries preserved", () => {
    it("should skip malformed entries and preserve valid ones", async () => {
      const validEntryArb = fc.tuple(
        alphanumStr,
        fc.oneof(
          fc.tuple(positiveNum, positiveNum).map((arr) => arr as number[]),
          fc
            .tuple(positiveNum, positiveNum, positiveNum)
            .map((arr) => arr as number[]),
        ),
      );

      const malformedValueArb = fc.oneof(
        fc.constant("not-an-array" as const),
        fc.constant(42 as const),
        fc.constant(null),
        fc.constant([1] as number[]),
        fc.constant([1, 2, 3, 4] as number[]),
        fc.constant(["a", "b"] as string[]),
      );

      const malformedEntryArb = fc.tuple(
        alphanumStr.map((s: string) => `bad_${s}`),
        malformedValueArb,
      );

      await fc.assert(
        fc.asyncProperty(
          fc.array(validEntryArb, { minLength: 1, maxLength: 5 }),
          fc.array(malformedEntryArb, { minLength: 1, maxLength: 5 }),
          async (validEntries, malformedEntries) => {
            const parser = new TestParser("/test/repo");
            const yamlObj: Record<string, any> = {};

            // Use unique keys to avoid collisions
            const validKeys = new Set<string>();
            for (const [key, value] of validEntries) {
              const uniqueKey = `valid_${key}`;
              yamlObj[uniqueKey] = value;
              validKeys.add(uniqueKey);
            }
            for (const [key, value] of malformedEntries) {
              yamlObj[key] = value;
            }

            const yamlContent = yamlStringify(yamlObj);

            vi.spyOn(FileSystemUtils, "fileExists").mockResolvedValue(true);
            vi.spyOn(FileSystemUtils, "readFile").mockResolvedValue(
              yamlContent,
            );

            const map = await parser.testLoadRateLimitMap();

            // All valid entries should be in the map
            for (const validKey of validKeys) {
              expect(map.has(validKey)).toBe(true);
            }

            // No malformed entries should be in the map
            for (const [key] of malformedEntries) {
              expect(map.has(key)).toBe(false);
            }

            vi.restoreAllMocks();
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

describe("BaseParser - lookupRateLimit", () => {
  let parser: TestParser;

  beforeEach(() => {
    parser = new TestParser("/test/repo");
    vi.restoreAllMocks();
  });

  it("should return correct RateLimit for a known key", async () => {
    const yamlContent = "TestApi-getItem:\n  - 5\n  - 10\n";
    vi.spyOn(FileSystemUtils, "fileExists").mockResolvedValue(true);
    vi.spyOn(FileSystemUtils, "readFile").mockResolvedValue(yamlContent);

    const result = await parser.testLookupRateLimit("TestApi", "getItem");
    expect(result).toEqual({
      requestsPerSecond: 5,
      burst: 10,
      intervalInSeconds: 1,
    });
  });

  /**
   * Property 5: Lookup returns correct RateLimit with proper field mapping
   *
   * For any entry with rate R, burst B, interval I: if I <= 1, requestsPerSecond === R;
   * if I > 1, requestsPerMinute === (R / I) * 60; and burst === B, intervalInSeconds === I.
   *
   * **Validates: Requirements 3.2, 3.4**
   */
  describe("Property 5: Lookup returns correct RateLimit with proper field mapping", () => {
    it("should map fields correctly based on intervalInSeconds", async () => {
      await fc.assert(
        fc.asyncProperty(
          alphanumStr,
          alphanumStr,
          positiveNum,
          positiveNum,
          positiveNum,
          async (className, methodName, rate, burst, interval) => {
            const parser = new TestParser("/test/repo");
            const key = `${className}-${normalizeMethodName(methodName)}`;
            const yamlObj: Record<string, number[]> = {};
            yamlObj[key] = [rate, burst, interval];
            const yamlContent = yamlStringify(yamlObj);

            vi.spyOn(FileSystemUtils, "fileExists").mockResolvedValue(true);
            vi.spyOn(FileSystemUtils, "readFile").mockResolvedValue(
              yamlContent,
            );

            const result = await parser.testLookupRateLimit(
              className,
              methodName,
            );

            expect(result).not.toBeNull();
            expect(result!.burst).toBe(burst);
            expect(result!.intervalInSeconds).toBe(interval);

            if (interval <= 1) {
              expect(result!.requestsPerSecond).toBe(rate);
              expect(result!.requestsPerMinute).toBeUndefined();
            } else {
              expect(result!.requestsPerMinute).toBe((rate / interval) * 60);
              expect(result!.requestsPerSecond).toBeUndefined();
            }

            vi.restoreAllMocks();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 6: Missing key lookup returns null
   *
   * For any key not in the map, lookupRateLimit returns null.
   *
   * **Validates: Requirements 3.3, 4.6**
   */
  describe("Property 6: Missing key lookup returns null", () => {
    it("should return null for keys not in the map", async () => {
      await fc.assert(
        fc.asyncProperty(
          alphanumStr,
          alphanumStr,
          async (className, methodName) => {
            const parser = new TestParser("/test/repo");
            // Empty YAML - no entries
            vi.spyOn(FileSystemUtils, "fileExists").mockResolvedValue(true);
            vi.spyOn(FileSystemUtils, "readFile").mockResolvedValue("{}");

            const result = await parser.testLookupRateLimit(
              className,
              methodName,
            );
            expect(result).toBeNull();

            vi.restoreAllMocks();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 7: Operation key format
   *
   * For any className and methodName (non-empty, alphanumeric), the key should
   * be `${className}-${methodName}`.
   *
   * **Validates: Requirements 4.6**
   */
  describe("Property 7: Operation key format", () => {
    it("should construct key as className-methodName", async () => {
      await fc.assert(
        fc.asyncProperty(
          alphanumStr,
          alphanumStr,
          positiveNum,
          positiveNum,
          async (className, methodName, rate, burst) => {
            const parser = new TestParser("/test/repo");
            const expectedKey = `${className}-${normalizeMethodName(methodName)}`;
            const yamlObj: Record<string, number[]> = {};
            yamlObj[expectedKey] = [rate, burst];
            const yamlContent = yamlStringify(yamlObj);

            vi.spyOn(FileSystemUtils, "fileExists").mockResolvedValue(true);
            vi.spyOn(FileSystemUtils, "readFile").mockResolvedValue(
              yamlContent,
            );

            const result = await parser.testLookupRateLimit(
              className,
              methodName,
            );
            // If the key format is correct, we should find the entry
            expect(result).not.toBeNull();
            expect(result!.requestsPerSecond).toBe(rate);
            expect(result!.burst).toBe(burst);

            vi.restoreAllMocks();
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
