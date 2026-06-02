import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  renameSync,
} from "fs";
import { join } from "path";
import * as cheerio from "cheerio";
import type {
  IndexManagerConfig,
  IndexMetadata,
  VectorStoreItem,
} from "./types.js";
import type { VectorStore } from "./vector-store.js";
import { VectraVectorStore } from "./vector-store.js";
import type { EmbeddingService } from "./embedding-service.js";
import type { Crawler } from "./crawlers/crawler-interface.js";
import { logger } from "../../utils/logger.js";

/**
 * Orchestrates the full indexing lifecycle: pre-built index loading,
 * crawling, chunking, embedding, and freshness checks.
 */
export class IndexManager {
  private config: IndexManagerConfig;
  private vectorStore: VectorStore;
  private embeddingService: EmbeddingService;
  private crawlers: Map<string, Crawler> = new Map();
  private reindexing = false;

  constructor(
    config: IndexManagerConfig,
    vectorStore: VectorStore,
    embeddingService: EmbeddingService,
  ) {
    this.config = config;
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;
  }

  /** Register a crawler for a named source. */
  registerCrawler(name: string, crawler: Crawler): void {
    this.crawlers.set(name, crawler);
  }

  /**
   * Initialize index: copy pre-built if needed, check freshness,
   * trigger background refresh if stale, and schedule periodic checks.
   */
  async initialize(): Promise<void> {
    const indexDir = join(this.config.dataDir, "index");

    // If no local index, copy pre-built
    if (!existsSync(indexDir) || !(await this.vectorStore.hasIndex())) {
      await this.copyPrebuiltIndex();
    } else {
      // Local index exists — check if the pre-built index from a newer package version is fresher
      await this.upgradeFromPrebuiltIfNewer();
    }

    // Check freshness and trigger reindex if stale
    await this.checkAndRefresh();

    // Schedule periodic staleness checks so long-running servers stay fresh
    this.schedulePeriodicRefresh();
  }

  /** Check if the index is stale and trigger a background reindex if needed. */
  private async checkAndRefresh(): Promise<void> {
    const metadata = await this.getMetadata();
    if (!metadata || this.isStale(metadata)) {
      this.reindex().catch((err) =>
        logger.error("Background reindex failed", err),
      );
    }
  }

  /** Schedule periodic staleness checks every 30 minutes. */
  private schedulePeriodicRefresh(): void {
    const checkIntervalMs = 30 * 60 * 1000; // 30 minutes
    globalThis.setInterval(() => {
      this.checkAndRefresh().catch((err) =>
        logger.error("Periodic refresh check failed", err),
      );
    }, checkIntervalMs);
  }

  /** Remove the staging directory if it exists. */
  private cleanStagingDir(stagingDir: string): void {
    if (existsSync(stagingDir)) {
      rmSync(stagingDir, { recursive: true, force: true });
    }
  }

  /**
   * Run a full re-index from all registered crawlers.
   * Builds into a staging directory, then atomically swaps with the live index.
   * This ensures the live index is always complete and consistent — if the process
   * is interrupted mid-reindex, the existing index remains untouched.
   * Retries once on failure in case of transient issues.
   */
  async reindex(attempt = 1): Promise<void> {
    if (this.reindexing) {
      logger.info("Reindex already in progress, skipping");
      return;
    }
    this.reindexing = true;

    try {
      await this.doReindex(attempt);
    } finally {
      this.reindexing = false;
    }
  }

  private async doReindex(attempt: number): Promise<void> {
    const indexDir = join(this.config.dataDir, "index");
    const stagingDir = join(this.config.dataDir, "index-staging");
    const oldDir = join(this.config.dataDir, "index-old");

    // Clean up any leftover staging directory from a previous interrupted run
    this.cleanStagingDir(stagingDir);

    // Build the new index in a staging directory
    const stagingStore = new VectraVectorStore(stagingDir);
    let totalChunks = 0;
    const crawlHistory: IndexMetadata["crawlHistory"] = [];

    for (const [name, crawler] of this.crawlers) {
      try {
        const documents = await crawler.crawl();

        for (const doc of documents) {
          const cleanText = this.stripHtml(doc.htmlContent);
          if (!cleanText) continue;

          const chunks = this.chunkText(
            cleanText,
            this.config.chunkMaxTokens,
            this.config.chunkOverlapTokens,
          );

          for (let i = 0; i < chunks.length; i++) {
            // Skip chunks that are too short to be meaningful
            if (chunks[i].length < 100) continue;

            // Prepend page title to each chunk for better topic context in embeddings
            const chunkText = `${doc.title}: ${chunks[i]}`;
            const chunkId = `${doc.url}#chunk-${i}`;
            const vector = await this.embeddingService.embedDocument(chunkText);

            const item: VectorStoreItem = {
              id: chunkId,
              text: chunkText,
              metadata: {
                title: doc.title,
                sourceUrl: doc.url,
                sourceType: doc.sourceType,
                category: doc.category,
                locale: doc.locale,
                lastUpdated: doc.lastUpdated,
                chunkIndex: i,
              },
            };

            await stagingStore.upsert(item, vector);
            totalChunks++;
          }
        }

        crawlHistory.push({
          source: name,
          timestamp: new Date().toISOString(),
          documentsCrawled: documents.length,
        });
      } catch (error) {
        logger.error(
          `Crawler ${name} failed, aborting reindex to preserve existing index`,
          error,
        );
        this.cleanStagingDir(stagingDir);
        if (attempt < 2) {
          logger.info("Retrying reindex in case of transient failure...");
          return this.doReindex(attempt + 1);
        }
        return;
      }
    }

    if (totalChunks === 0) {
      logger.error("No chunks produced. Keeping existing index. Aborting");
      this.cleanStagingDir(stagingDir);
      if (attempt < 2) {
        logger.info("Retrying reindex after zero chunks...");
        return this.doReindex(attempt + 1);
      }
      return;
    }

    // Atomic swap: rename current → old, staging → current, delete old
    try {
      if (existsSync(oldDir)) {
        rmSync(oldDir, { recursive: true, force: true });
      }
      if (existsSync(indexDir)) {
        renameSync(indexDir, oldDir);
      }
      renameSync(stagingDir, indexDir);
      if (existsSync(oldDir)) {
        rmSync(oldDir, { recursive: true, force: true });
      }

      // Reload the vector store to pick up the new index
      this.vectorStore = new VectraVectorStore(indexDir);

      logger.info(`Reindex complete: ${totalChunks} chunks indexed`);
    } catch (error) {
      logger.error("Failed to swap index directories", error);
      this.cleanStagingDir(stagingDir);
      return;
    }

    // Save metadata
    const metadata: IndexMetadata = {
      lastSuccessfulIndex: new Date().toISOString(),
      documentCount: totalChunks,
      crawlHistory,
    };
    await this.saveMetadata(metadata);

    // Clean up crawl cache after successful reindex
    this.cleanCrawlCache();
  }

  /** Remove the crawl cache directory to free disk space after a successful reindex. */
  private cleanCrawlCache(): void {
    const cacheDir = join(this.config.dataDir, "cache");
    try {
      if (existsSync(cacheDir)) {
        rmSync(cacheDir, { recursive: true, force: true });
        logger.info("Cleaned crawl cache after successful reindex");
      }
    } catch (error) {
      logger.warn("Failed to clean crawl cache", error);
    }
  }

  /** Read metadata.json from the data directory. */
  async getMetadata(): Promise<IndexMetadata | null> {
    const metadataPath = join(this.config.dataDir, "metadata.json");
    try {
      if (existsSync(metadataPath)) {
        const content = readFileSync(metadataPath, "utf-8");
        return JSON.parse(content) as IndexMetadata;
      }
    } catch (error) {
      logger.error("Failed to read metadata", error);
    }
    return null;
  }

  /** Write metadata.json to the data directory. */
  private async saveMetadata(metadata: IndexMetadata): Promise<void> {
    const metadataPath = join(this.config.dataDir, "metadata.json");
    try {
      if (!existsSync(this.config.dataDir)) {
        mkdirSync(this.config.dataDir, { recursive: true });
      }
      writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
    } catch (error) {
      logger.error("Failed to save metadata", error);
    }
  }

  /** Copy pre-built index from package to user-local directory. */
  private async copyPrebuiltIndex(): Promise<void> {
    const indexDir = join(this.config.dataDir, "index");
    try {
      if (existsSync(this.config.prebuiltIndexPath)) {
        mkdirSync(indexDir, { recursive: true });
        cpSync(this.config.prebuiltIndexPath, indexDir, { recursive: true });
        logger.info("Copied pre-built index to local directory");

        // Also copy metadata if it exists alongside the pre-built index
        const prebuiltMetadata = join(
          this.config.prebuiltIndexPath,
          "..",
          "metadata.json",
        );
        if (existsSync(prebuiltMetadata)) {
          const metadataPath = join(this.config.dataDir, "metadata.json");
          cpSync(prebuiltMetadata, metadataPath);
        }
      } else {
        logger.warn("Pre-built index not found, will build on next refresh");
      }
    } catch (error) {
      logger.error("Failed to copy pre-built index", error);
    }
  }

  /**
   * If the package ships a newer pre-built index than the local one,
   * replace the local index with the pre-built one. This handles
   * package upgrades where the pre-built index is fresher.
   */
  private async upgradeFromPrebuiltIfNewer(): Promise<void> {
    try {
      const prebuiltMetadataPath = join(
        this.config.prebuiltIndexPath,
        "..",
        "metadata.json",
      );
      if (!existsSync(prebuiltMetadataPath)) return;

      const localMetadata = await this.getMetadata();
      if (!localMetadata) return;

      const prebuiltContent = readFileSync(prebuiltMetadataPath, "utf-8");
      const prebuiltMetadata = JSON.parse(prebuiltContent) as IndexMetadata;

      const localTime = new Date(localMetadata.lastSuccessfulIndex).getTime();
      const prebuiltTime = new Date(
        prebuiltMetadata.lastSuccessfulIndex,
      ).getTime();

      if (prebuiltTime > localTime) {
        logger.info(
          "Package contains a newer pre-built index, upgrading local index",
        );
        await this.copyPrebuiltIndex();
      }
    } catch (error) {
      logger.error("Failed to check pre-built index for upgrade", error);
    }
  }

  /** Check if index is stale based on refresh interval. */
  isStale(metadata: IndexMetadata): boolean {
    const lastIndex = new Date(metadata.lastSuccessfulIndex).getTime();
    const now = Date.now();
    return now - lastIndex > this.config.stalenessThresholdMs;
  }

  /**
   * Strip HTML tags and non-content markup from raw HTML.
   * Removes nav, header, footer, script, style, and aside elements.
   * Preserves links by converting <a href="url">text</a> to "text (url)".
   * Extracts text content and collapses whitespace.
   */
  stripHtml(html: string): string {
    const $ = cheerio.load(html);

    // Remove non-content elements
    $("nav, header, footer, script, style, aside").remove();

    // Convert links to "text (url)" format before extracting text
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim();
      if (href && text && href.startsWith("http")) {
        $(el).replaceWith(`${text} (${href})`);
      }
    });

    // Convert HTML tables to natural language text using column headers
    $("table").each((_, table) => {
      const headers: string[] = [];
      $(table)
        .find("tr")
        .first()
        .find("th, td")
        .each((_, cell) => {
          headers.push($(cell).text().trim());
        });

      const rows: string[] = [];
      $(table)
        .find("tr")
        .slice(1) // skip header row
        .each((_, tr) => {
          const cells: string[] = [];
          $(tr)
            .find("td")
            .each((_, cell) => {
              cells.push($(cell).text().trim());
            });
          if (cells.length > 0 && headers.length > 0) {
            // Combine headers with cell values: "Header1: value1, Header2: value2."
            const parts = cells.map(
              (val, i) => `${headers[i] || "Column " + (i + 1)}: ${val}`,
            );
            rows.push(parts.join(", ") + ".");
          }
        });
      $(table).replaceWith(" " + rows.join(" ") + " ");
    });

    // Extract text and collapse whitespace
    const text = $.text();
    return text.replace(/\s+/g, " ").trim();
  }

  /**
   * Split text into chunks of configurable size with overlap.
   * Splits on sentence boundaries (., ?, ! followed by space or end),
   * accumulates sentences until approaching maxTokens,
   * and overlaps consecutive chunks by overlapTokens worth of content.
   *
   * Token approximation: 1 token ≈ 4 characters.
   */
  chunkText(text: string, maxTokens: number, overlapTokens: number): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const maxChars = maxTokens * 4;
    const overlapChars = overlapTokens * 4;
    const trimmed = text.trim();

    // If the entire text fits in one chunk, return it directly
    if (trimmed.length <= maxChars) {
      return [trimmed];
    }

    // Protect URLs from sentence splitting by temporarily replacing them with placeholders
    const placeholders: string[] = [];
    let protected_ = trimmed.replace(/https?:\/\/[^\s)]+/g, (match) => {
      placeholders.push(match);
      return `__PH_${placeholders.length - 1}__`;
    });
    // Also protect parenthesized URLs like (https://...)
    protected_ = protected_.replace(/\([^)]*__PH_\d+__[^)]*\)/g, (match) => {
      placeholders.push(match);
      return `__PH_${placeholders.length - 1}__`;
    });
    // Protect decimal numbers (e.g., 0.5, 0.0056) from being split at the period
    protected_ = protected_.replace(/\d+\.\d+/g, (match) => {
      placeholders.push(match);
      return `__PH_${placeholders.length - 1}__`;
    });

    // Split on sentence boundaries: period, question mark, or exclamation mark
    // followed by a space or end of string
    const sentences = protected_.match(/[^.!?]*[.!?](?:\s|$)|[^.!?]+$/g);
    if (!sentences) {
      return [trimmed];
    }

    // Restore placeholders and clean up sentences
    const cleanSentences = sentences
      .map((s) => {
        let restored = s.trim();
        for (let j = placeholders.length - 1; j >= 0; j--) {
          restored = restored.replace(`__PH_${j}__`, placeholders[j]);
        }
        return restored;
      })
      .filter((s) => s.length > 0);

    const chunks: string[] = [];
    let currentSentences: string[] = [];
    let currentLength = 0;

    for (const sentence of cleanSentences) {
      const sentenceLength = sentence.length;
      const separatorLength = currentSentences.length > 0 ? 1 : 0; // space between sentences

      if (
        currentLength + separatorLength + sentenceLength > maxChars &&
        currentSentences.length > 0
      ) {
        // Current chunk is full, save it
        chunks.push(currentSentences.join(" "));

        // Calculate overlap: walk backwards through sentences to find overlap content
        const overlapSentences: string[] = [];
        let overlapLength = 0;
        for (let i = currentSentences.length - 1; i >= 0; i--) {
          const sLen = currentSentences[i].length;
          const sepLen = overlapSentences.length > 0 ? 1 : 0;
          if (overlapLength + sepLen + sLen > overlapChars) {
            break;
          }
          overlapSentences.unshift(currentSentences[i]);
          overlapLength += sepLen + sLen;
        }

        currentSentences = [...overlapSentences];
        currentLength = overlapLength;
      }

      currentSentences.push(sentence);
      currentLength += separatorLength + sentenceLength;
    }

    // Don't forget the last chunk
    if (currentSentences.length > 0) {
      chunks.push(currentSentences.join(" "));
    }

    return chunks;
  }
}
