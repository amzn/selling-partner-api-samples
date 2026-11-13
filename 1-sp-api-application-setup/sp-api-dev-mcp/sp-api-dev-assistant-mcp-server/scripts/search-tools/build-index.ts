#!/usr/bin/env tsx

/**
 * Build script: crawls SP-API docs and generates a pre-built vector index.
 * Writes directly to dist/data/prebuilt-index/ — does NOT use the atomic swap
 * reindex path (that's for runtime refresh only).
 *
 * Run: npm run build:index
 */

import { join } from "path";
import { mkdirSync, writeFileSync } from "fs";
import { TransformersEmbeddingService } from "../../src/tools/search-tools/embedding-service.js";
import { VectraVectorStore } from "../../src/tools/search-tools/vector-store.js";
import { IndexManager } from "../../src/tools/search-tools/index-manager.js";
import { SPAPIDocsCrawler } from "../../src/tools/search-tools/crawlers/sp-api-docs-crawler.js";
import type {
  IndexMetadata,
  VectorStoreItem,
} from "../../src/tools/search-tools/types.js";

async function buildIndex() {
  const outputDir = join(process.cwd(), "dist", "data");
  const indexDir = join(outputDir, "prebuilt-index");
  const cacheDir = join(process.cwd(), "build", "crawl-cache");

  console.log("Building pre-built search index...");
  console.log(`Output: ${indexDir}`);

  mkdirSync(indexDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });

  const embeddingService = new TransformersEmbeddingService();
  const vectorStore = new VectraVectorStore(indexDir);

  // We use IndexManager only for stripHtml/chunkText — not reindex()
  const indexManager = new IndexManager(
    {
      dataDir: outputDir,
      prebuiltIndexPath: indexDir,
      stalenessThresholdMs: 0,
      chunkMaxTokens: 256,
      chunkOverlapTokens: 50,
    },
    vectorStore,
    embeddingService,
  );

  const crawler = new SPAPIDocsCrawler(cacheDir);
  console.log("Crawling, processing and embedding SP-API docs (en-US)...");
  let totalChunks = 0;
  let documentsCrawled = 0;

  await vectorStore.beginUpdate();

  for await (const doc of crawler.crawl()) {
    documentsCrawled++;
    const cleanText = indexManager.stripHtml(doc.htmlContent);
    if (!cleanText) continue;

    const chunks = indexManager.chunkText(cleanText, 256, 50);

    const pending: Array<{ chunkIndex: number; text: string }> = [];
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].length < 100) continue;

      pending.push({ chunkIndex: i, text: `${doc.title}: ${chunks[i]}` });
    }

    const vectors = await embeddingService.embedDocumentBatch(
      pending.map((chunk) => chunk.text),
    );

    for (let i = 0; i < pending.length; i++) {
      const item: VectorStoreItem = {
        id: `${doc.url}#chunk-${pending[i].chunkIndex}`,
        text: pending[i].text,
        metadata: {
          title: doc.title,
          sourceUrl: doc.url,
          sourceType: doc.sourceType,
          category: doc.category,
          locale: doc.locale,
          lastUpdated: doc.lastUpdated,
          chunkIndex: pending[i].chunkIndex,
        },
      };

      await vectorStore.upsert(item, vectors[i]);
      totalChunks++;
    }
  }

  await vectorStore.endUpdate();

  console.log(`Crawled ${documentsCrawled} pages.`);

  // Write metadata
  const metadata: IndexMetadata = {
    lastSuccessfulIndex: new Date().toISOString(),
    documentCount: totalChunks,
    crawlHistory: [
      {
        source: "sp-api-docs",
        timestamp: new Date().toISOString(),
        documentsCrawled,
      },
    ],
  };
  writeFileSync(
    join(outputDir, "metadata.json"),
    JSON.stringify(metadata, null, 2),
    "utf-8",
  );

  console.log(`Index built successfully with ${totalChunks} chunks.`);
  console.log(`Index location: ${indexDir}`);
}

buildIndex().catch((error) => {
  console.error("Failed to build index:", error);
  process.exit(1);
});
