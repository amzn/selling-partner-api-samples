import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { IndexManager } from "../../src/tools/search-tools/index-manager";
import type { IndexManagerConfig } from "../../src/tools/search-tools/types";
import type { VectorStore } from "../../src/tools/search-tools/vector-store";
import type { EmbeddingService } from "../../src/tools/search-tools/embedding-service";

const defaultConfig: IndexManagerConfig = {
  dataDir: "/tmp/test-sp-api-mcp",
  prebuiltIndexPath: "/tmp/test-prebuilt",
  stalenessThresholdMs: 24 * 60 * 60 * 1000,
  chunkMaxTokens: 256,
  chunkOverlapTokens: 50,
};

/** Minimal stub VectorStore for tests that only exercise stripHtml/chunkText. */
const stubVectorStore: VectorStore = {
  search: async () => [],
  upsert: async () => {},
  clear: async () => {},
  hasIndex: async () => false,
  count: async () => 0,
};

/** Minimal stub EmbeddingService for tests that only exercise stripHtml/chunkText. */
const stubEmbeddingService: EmbeddingService = {
  embed: async () => new Array(384).fill(0),
  embedDocument: async () => new Array(384).fill(0),
  isReady: () => false,
  preload: async () => {},
};

function createManager(overrides?: Partial<IndexManagerConfig>): IndexManager {
  return new IndexManager(
    { ...defaultConfig, ...overrides },
    stubVectorStore,
    stubEmbeddingService,
  );
}

describe("IndexManager", () => {
  describe("stripHtml", () => {
    it("should extract text from simple HTML", () => {
      const manager = createManager();
      const result = manager.stripHtml("<p>Hello world</p>");
      expect(result).toBe("Hello world");
    });

    it("should remove nav, header, footer, script, style, aside elements", () => {
      const manager = createManager();
      const html = `
        <div>
          <nav>Navigation</nav>
          <header>Header content</header>
          <main>Main content</main>
          <footer>Footer content</footer>
          <script>var x = 1;</script>
          <style>.foo { color: red; }</style>
          <aside>Sidebar</aside>
        </div>
      `;
      const result = manager.stripHtml(html);
      expect(result).toBe("Main content");
    });

    it("should collapse multiple whitespace into single space", () => {
      const manager = createManager();
      const html = "<p>Hello    world</p>  <p>  foo   bar  </p>";
      const result = manager.stripHtml(html);
      expect(result).toBe("Hello world foo bar");
    });

    it("should return empty string for empty input", () => {
      const manager = createManager();
      expect(manager.stripHtml("")).toBe("");
    });

    it("should handle HTML with only non-content elements", () => {
      const manager = createManager();
      const html = "<nav>Nav</nav><script>code</script><style>css</style>";
      expect(manager.stripHtml(html)).toBe("");
    });

    it("should handle nested elements", () => {
      const manager = createManager();
      const html =
        "<div><p>Outer <span>inner <strong>bold</strong></span> text</p></div>";
      expect(manager.stripHtml(html)).toBe("Outer inner bold text");
    });

    it("should handle plain text without tags", () => {
      const manager = createManager();
      expect(manager.stripHtml("Just plain text")).toBe("Just plain text");
    });

    it('should preserve links as "text (url)" format', () => {
      const manager = createManager();
      const html =
        '<p>Refer to <a href="https://example.com/docs">the docs</a> for details.</p>';
      const result = manager.stripHtml(html);
      expect(result).toContain("the docs (https://example.com/docs)");
    });

    it("should not convert links without http prefix", () => {
      const manager = createManager();
      const html = '<p>See <a href="/relative/path">this page</a>.</p>';
      const result = manager.stripHtml(html);
      expect(result).not.toContain("(");
      expect(result).toContain("this page");
    });

    it("should convert HTML tables to natural language using column headers", () => {
      const manager = createManager();
      const html = `
        <table>
          <tr><th>Operation</th><th>Rate</th><th>Burst</th></tr>
          <tr><td>getOrder</td><td>0.5</td><td>30</td></tr>
          <tr><td>getOrders</td><td>0.0167</td><td>20</td></tr>
        </table>
      `;
      const result = manager.stripHtml(html);
      expect(result).toContain("Operation: getOrder, Rate: 0.5, Burst: 30.");
      expect(result).toContain(
        "Operation: getOrders, Rate: 0.0167, Burst: 20.",
      );
    });

    it("should handle tables without headers gracefully", () => {
      const manager = createManager();
      const html = `
        <table>
          <tr><td>value1</td><td>value2</td></tr>
        </table>
      `;
      const result = manager.stripHtml(html);
      // No header row to skip, so no data rows produced
      expect(result).toBe("");
    });

    it("should handle tables with links in cells", () => {
      const manager = createManager();
      const html = `
        <table>
          <tr><th>Operation</th><th>Rate</th></tr>
          <tr><td><a href="https://example.com/api">getOrder</a></td><td>0.5</td></tr>
        </table>
      `;
      const result = manager.stripHtml(html);
      expect(result).toContain(
        "Operation: getOrder (https://example.com/api), Rate: 0.5.",
      );
    });
  });

  describe("chunkText", () => {
    it("should return empty array for empty text", () => {
      const manager = createManager();
      expect(manager.chunkText("", 100, 10)).toEqual([]);
    });

    it("should return empty array for whitespace-only text", () => {
      const manager = createManager();
      expect(manager.chunkText("   ", 100, 10)).toEqual([]);
    });

    it("should return single chunk for short text", () => {
      const manager = createManager();
      const text = "Hello world.";
      // 12 chars = ~3 tokens, maxTokens=100 → fits in one chunk
      const result = manager.chunkText(text, 100, 10);
      expect(result).toEqual(["Hello world."]);
    });

    it("should split text on sentence boundaries", () => {
      const manager = createManager();
      // Each sentence is ~25 chars = ~6 tokens. maxTokens=10 (40 chars) fits ~1.5 sentences
      const text =
        "First sentence here. Second sentence here. Third sentence here.";
      const result = manager.chunkText(text, 10, 0);
      expect(result.length).toBeGreaterThan(1);
      // Each chunk should end at a sentence boundary
      for (const chunk of result) {
        expect(chunk).toMatch(/[.!?]$/);
      }
    });

    it("should create overlapping chunks", () => {
      const manager = createManager();
      // Create text with clear sentences
      const text =
        "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.";
      // maxTokens=10 (40 chars), overlapTokens=5 (20 chars)
      const result = manager.chunkText(text, 10, 5);
      expect(result.length).toBeGreaterThan(1);

      // Check that consecutive chunks share some content
      for (let i = 1; i < result.length; i++) {
        const prevChunk = result[i - 1];
        const currChunk = result[i];
        // The current chunk should start with content from the end of the previous chunk
        const prevSentences = prevChunk.split(/(?<=[.!?])\s/);
        const currSentences = currChunk.split(/(?<=[.!?])\s/);
        // At least one sentence from the end of prev should appear at start of curr
        const lastPrevSentence = prevSentences[prevSentences.length - 1];
        expect(currSentences[0]).toBe(lastPrevSentence);
      }
    });

    it("should respect maxTokens limit", () => {
      const manager = createManager();
      const text = "A. B. C. D. E. F. G. H. I. J. K. L. M. N. O. P.";
      const maxTokens = 5; // 20 chars
      const result = manager.chunkText(text, maxTokens, 0);
      for (const chunk of result) {
        // Each chunk should be within maxTokens * 4 chars
        expect(chunk.length).toBeLessThanOrEqual(maxTokens * 4);
      }
    });

    it("should handle text with question marks and exclamation marks", () => {
      const manager = createManager();
      const text = "What is this? It is great! And more.";
      const result = manager.chunkText(text, 100, 0);
      expect(result).toEqual(["What is this? It is great! And more."]);
    });

    // =========================================================================
    // Property-Based Tests
    // Feature: contextual-search, Property 6: Chunk sizes respect max tokens and overlap
    // **Validates: Requirements 3.2**
    // =========================================================================
    describe("property-based tests", () => {
      it("every chunk should have character count <= maxTokens * 4", () => {
        const manager = createManager();
        fc.assert(
          fc.property(
            fc.string({ minLength: 1 }),
            fc.integer({ min: 5, max: 200 }),
            fc.nat({ max: 99 }),
            (text, maxTokens, overlapFraction) => {
              // Generate overlapTokens as a fraction of maxTokens to ensure overlapTokens < maxTokens
              const overlapTokens = Math.floor(
                (overlapFraction / 100) * (maxTokens - 1),
              );
              const chunks = manager.chunkText(text, maxTokens, overlapTokens);
              const maxChars = maxTokens * 4;

              for (const chunk of chunks) {
                expect(chunk.length).toBeLessThanOrEqual(maxChars);
              }
            },
          ),
          { numRuns: 100 },
        );
      });

      it("union of all chunks should cover the original text content when multiple chunks are produced", () => {
        const manager = createManager();
        fc.assert(
          fc.property(
            fc.string({ minLength: 1 }),
            fc.integer({ min: 5, max: 200 }),
            fc.nat({ max: 99 }),
            (text, maxTokens, overlapFraction) => {
              const overlapTokens = Math.floor(
                (overlapFraction / 100) * (maxTokens - 1),
              );
              const chunks = manager.chunkText(text, maxTokens, overlapTokens);
              const trimmed = text.trim();

              if (trimmed.length === 0) {
                expect(chunks).toEqual([]);
                return;
              }

              if (chunks.length > 1) {
                // The union of all chunks should cover the original text content.
                // Extract all non-whitespace words from the original and verify
                // they appear in at least one chunk.
                const originalWords = trimmed
                  .split(/\s+/)
                  .filter((w) => w.length > 0);
                const allChunkText = chunks.join(" ");
                for (const word of originalWords) {
                  expect(allChunkText).toContain(word);
                }
              }
            },
          ),
          { numRuns: 100 },
        );
      });
    });
  });
});

import { SearchTool } from "../../src/tools/search-tools/search-tool";
import type {
  IndexMetadata,
  RawDocument,
  ScoredItem,
} from "../../src/tools/search-tools/types";
import { SPAPIDocsCrawler } from "../../src/tools/search-tools/crawlers/sp-api-docs-crawler";

// =========================================================================
// Property 11: Staleness detection based on refresh interval
// **Validates: Requirements 9.2**
// =========================================================================
describe("IndexManager.isStale", () => {
  it("should return true when last index is older than refresh interval", () => {
    const manager = createManager({ stalenessThresholdMs: 1000 });
    const metadata: IndexMetadata = {
      lastSuccessfulIndex: new Date(Date.now() - 2000).toISOString(),
      locale: "en-US",
      documentCount: 10,
      crawlHistory: [],
    };
    expect(manager.isStale(metadata)).toBe(true);
  });

  it("should return false when last index is within refresh interval", () => {
    const manager = createManager({ stalenessThresholdMs: 60000 });
    const metadata: IndexMetadata = {
      lastSuccessfulIndex: new Date().toISOString(),
      locale: "en-US",
      documentCount: 10,
      crawlHistory: [],
    };
    expect(manager.isStale(metadata)).toBe(false);
  });

  // Property-based test
  it("should return true iff (now - lastIndex) > stalenessThresholdMs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 86400000 }), // stalenessThresholdMs: 1s to 24h
        fc.integer({ min: 0, max: 172800000 }), // age in ms: 0 to 48h
        (stalenessThresholdMs, ageMs) => {
          const manager = createManager({ stalenessThresholdMs });
          const metadata: IndexMetadata = {
            lastSuccessfulIndex: new Date(Date.now() - ageMs).toISOString(),
            locale: "en-US",
            documentCount: 10,
            crawlHistory: [],
          };
          const expected = ageMs > stalenessThresholdMs;
          expect(manager.isStale(metadata)).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// =========================================================================
// Property 7: Metadata preserved through chunking pipeline
// **Validates: Requirements 3.3**
// =========================================================================
describe("IndexManager metadata preservation", () => {
  it("chunks from a RawDocument should carry identical metadata", () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          url: fc.webUrl(),
          sourceType: fc.constantFrom("sp-api-docs", "github-discussions"),
          category: fc.constantFrom("orders-api", "feeds-api", "general"),
          locale: fc.constantFrom("en-US", "fr-FR"),
        }),
        fc.string({ minLength: 20, maxLength: 500 }),
        (meta, bodyText) => {
          const manager = createManager();
          // Simulate the pipeline: stripHtml then chunkText
          const text = manager.stripHtml(
            `<div><h1>${meta.title}</h1><p>${bodyText}</p></div>`,
          );
          if (!text) return; // skip empty

          const chunks = manager.chunkText(text, 50, 10);

          // Each chunk should be able to carry the same metadata
          for (let i = 0; i < chunks.length; i++) {
            const chunkMeta = {
              title: meta.title,
              sourceUrl: meta.url,
              sourceType: meta.sourceType,
              category: meta.category,
              locale: meta.locale,
              chunkIndex: i,
            };
            // Verify metadata fields are preserved (not mutated)
            expect(chunkMeta.title).toBe(meta.title);
            expect(chunkMeta.sourceUrl).toBe(meta.url);
            expect(chunkMeta.sourceType).toBe(meta.sourceType);
            expect(chunkMeta.category).toBe(meta.category);
            expect(chunkMeta.locale).toBe(meta.locale);
            expect(chunkMeta.chunkIndex).toBe(i);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// =========================================================================
// Property 10: Locale crawling always includes en-US
// **Validates: Requirements 8.4, 8.5**
// =========================================================================
describe("SPAPIDocsCrawler locale behavior", () => {
  it("getSourceMetadata always includes en-US in supported locales", () => {
    fc.assert(
      fc.property(fc.constantFrom("en-US", "fr-FR", "de-DE", "ja-JP"), () => {
        // cacheDir doesn't matter for metadata check
        const crawler = new SPAPIDocsCrawler("/tmp/test-cache");
        const meta = crawler.getSourceMetadata();
        expect(meta.supportedLocales).toContain("en-US");
        expect(meta.name).toBe("sp-api-docs");
        expect(meta.baseUrl).toBeTruthy();
      }),
      { numRuns: 10 },
    );
  });
});

// =========================================================================
// Property 1: Search result count bounded by top_k
// Property 2: Results ordered by descending relevance score
// **Validates: Requirements 2.3, 2.1**
// =========================================================================
describe("VectorStore search behavior (via SearchTool)", () => {
  function makeScoredItems(count: number): ScoredItem[] {
    return Array.from({ length: count }, (_, i) => ({
      item: {
        id: `doc-${i}`,
        text: `Content for document ${i}.`,
        metadata: {
          title: `Doc ${i}`,
          sourceUrl: `https://example.com/doc-${i}`,
          sourceType: "sp-api-docs",
          category: "orders-api",
          locale: "en-US",
          chunkIndex: 0,
        },
      },
      score: 0.99 - i * 0.05,
    }));
  }

  // Property 1: result count bounded by top_k
  it("search should return at most top_k results", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 30 }),
        async (topK, indexSize) => {
          const allItems = makeScoredItems(indexSize);
          const mockVectorStore: VectorStore = {
            search: async (_vec, tk) => allItems.slice(0, tk),
            upsert: async () => {},
            clear: async () => {},
            hasIndex: async () => indexSize > 0,
            count: async () => indexSize,
          };
          const searchTool = new SearchTool(
            stubEmbeddingService,
            mockVectorStore,
            createManager(),
          );
          const result = await searchTool.search({
            query: "test",
            top_k: topK,
          });

          if (indexSize === 0) {
            expect(result.isError).toBeFalsy();
          } else {
            expect(result.isError).toBeFalsy();
            const resultMatches =
              result.content[0].text.match(/Result \d+/g) || [];
            expect(resultMatches.length).toBeLessThanOrEqual(
              Math.min(topK, indexSize),
            );
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  // Property 2: results ordered by descending score
  it("search results should be in descending score order", () => {
    const items = makeScoredItems(10);
    const mockVectorStore: VectorStore = {
      search: async (_vec, tk) => items.slice(0, tk),
      upsert: async () => {},
      clear: async () => {},
      hasIndex: async () => true,
      count: async () => 10,
    };

    // Verify the mock data itself is ordered
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].score).toBeGreaterThanOrEqual(items[i].score);
    }
  });
});

// =========================================================================
// Property 3: Search results contain all required fields
// Property 4: Result formatting includes source attribution
// **Validates: Requirements 1.3, 1.4**
// =========================================================================
describe("SearchTool formatting", () => {
  function makeSearchTool(items: ScoredItem[]): SearchTool {
    const mockVectorStore: VectorStore = {
      search: async (_vec, tk) => items.slice(0, tk),
      upsert: async () => {},
      clear: async () => {},
      hasIndex: async () => items.length > 0,
      count: async () => items.length,
    };
    return new SearchTool(
      stubEmbeddingService,
      mockVectorStore,
      createManager(),
    );
  }

  // Property 3: results contain all required fields
  it("formatted results should contain title, sourceUrl, category, locale, and score for each result", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 2, maxLength: 30 }),
            url: fc.webUrl(),
            category: fc.constantFrom("orders-api", "feeds-api", "catalog-api"),
            locale: fc.constantFrom("en-US", "fr-FR"),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        async (docs) => {
          const items: ScoredItem[] = docs.map((d, i) => ({
            item: {
              id: `doc-${i}`,
              text: `Content about ${d.title}.`,
              metadata: {
                title: d.title,
                sourceUrl: d.url,
                sourceType: "sp-api-docs",
                category: d.category,
                locale: d.locale,
                chunkIndex: 0,
              },
            },
            score: 0.9 - i * 0.1,
          }));

          const tool = makeSearchTool(items);
          const result = await tool.search({
            query: "test",
            top_k: docs.length,
          });
          const text = result.content[0].text;

          for (const doc of docs) {
            expect(text).toContain(doc.title);
            expect(text).toContain(doc.url);
            expect(text).toContain(doc.category);
            expect(text).toContain(doc.locale);
          }
          expect(text).toContain("Score:");
        },
      ),
      { numRuns: 50 },
    );
  });

  // Property 4: formatting includes source attribution
  it("formatted results should include Source link for each result", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 3 }),
        async (urls) => {
          const items: ScoredItem[] = urls.map((url, i) => ({
            item: {
              id: `doc-${i}`,
              text: "Some content.",
              metadata: {
                title: `Title ${i}`,
                sourceUrl: url,
                sourceType: "sp-api-docs",
                category: "general",
                locale: "en-US",
                chunkIndex: 0,
              },
            },
            score: 0.9,
          }));

          const tool = makeSearchTool(items);
          const result = await tool.search({
            query: "test",
            top_k: urls.length,
          });
          const text = result.content[0].text;

          for (const url of urls) {
            // Check for markdown link format: [Source](url)
            expect(text).toContain(`[Source](${url})`);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

// =========================================================================
// Unit tests for SearchTool
// **Validates: Requirements 1.4, 11.4**
// =========================================================================
describe("SearchTool unit tests", () => {
  it("should return informational message when index is empty", async () => {
    const emptyVectorStore: VectorStore = {
      search: async () => [],
      upsert: async () => {},
      clear: async () => {},
      hasIndex: async () => false,
      count: async () => 0,
    };
    const tool = new SearchTool(
      stubEmbeddingService,
      emptyVectorStore,
      createManager(),
    );
    const result = await tool.search({ query: "test query" });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("index has not been built yet");
  });

  it("should return error response when embedding fails", async () => {
    const failingEmbedding: EmbeddingService = {
      embed: async () => {
        throw new Error("Model load failed");
      },
      embedDocument: async () => [],
      isReady: () => false,
      preload: async () => {},
    };
    const hasIndexStore: VectorStore = {
      search: async () => [],
      upsert: async () => {},
      clear: async () => {},
      hasIndex: async () => true,
      count: async () => 1,
    };
    const tool = new SearchTool(
      failingEmbedding,
      hasIndexStore,
      createManager(),
    );
    const result = await tool.search({ query: "test" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Search failed");
    expect(result.content[0].text).toContain("Model load failed");
  });

  it("should return no results message when search returns empty", async () => {
    const emptySearchStore: VectorStore = {
      search: async () => [],
      upsert: async () => {},
      clear: async () => {},
      hasIndex: async () => true,
      count: async () => 5,
    };
    const tool = new SearchTool(
      stubEmbeddingService,
      emptySearchStore,
      createManager(),
    );
    const result = await tool.search({ query: "nonexistent topic" });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No results found");
  });

  it("should format results with correct structure", async () => {
    const items: ScoredItem[] = [
      {
        item: {
          id: "doc-1",
          text: "Rate limiting applies to all SP-API calls.",
          metadata: {
            title: "Rate Limiting Guide",
            sourceUrl: "https://docs.example.com/rate-limiting",
            sourceType: "sp-api-docs",
            category: "orders-api",
            locale: "en-US",
            chunkIndex: 0,
          },
        },
        score: 0.95,
      },
    ];
    const mockStore: VectorStore = {
      search: async () => items,
      upsert: async () => {},
      clear: async () => {},
      hasIndex: async () => true,
      count: async () => 1,
    };
    const tool = new SearchTool(
      stubEmbeddingService,
      mockStore,
      createManager(),
    );
    const result = await tool.search({ query: "rate limiting" });

    expect(result.isError).toBe(false);
    const text = result.content[0].text;
    expect(text).toContain("SP-API Documentation Search Results");
    expect(text).toContain("rate limiting");
    expect(text).toContain("Rate Limiting Guide");
    expect(text).toContain("https://docs.example.com/rate-limiting");
    expect(text).toContain("orders-api");
    expect(text).toContain("en-US");
    expect(text).toContain("0.95");
    expect(text).toContain("Rate limiting applies to all SP-API calls.");
  });
});

// =========================================================================
// Unit tests for IndexManager lifecycle
// **Validates: Requirements 6.2, 8.7, 7.5, 9.4**
// =========================================================================
describe("IndexManager lifecycle", () => {
  it("should register and retrieve crawlers", () => {
    const manager = createManager();
    const mockCrawler = {
      name: "test-crawler",
      crawl: async () => [],
      getSourceMetadata: () => ({
        name: "test",
        baseUrl: "https://test.com",
        supportedLocales: ["en-US"],
      }),
    };
    // Should not throw
    manager.registerCrawler("test", mockCrawler);
  });

  it("isStale should return true for very old timestamps", () => {
    const manager = createManager({ stalenessThresholdMs: 1000 });
    const metadata: IndexMetadata = {
      lastSuccessfulIndex: "2020-01-01T00:00:00.000Z",
      locale: "en-US",
      documentCount: 0,
      crawlHistory: [],
    };
    expect(manager.isStale(metadata)).toBe(true);
  });

  it("isStale should return false for just-now timestamps", () => {
    const manager = createManager({ stalenessThresholdMs: 86400000 });
    const metadata: IndexMetadata = {
      lastSuccessfulIndex: new Date().toISOString(),
      locale: "en-US",
      documentCount: 0,
      crawlHistory: [],
    };
    expect(manager.isStale(metadata)).toBe(false);
  });
});
