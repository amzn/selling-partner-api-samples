import { join } from "path";
import { TransformersEmbeddingService } from "./embedding-service.js";
import { VectraVectorStore } from "./vector-store.js";
import { IndexManager } from "./index-manager.js";
import { SearchTool } from "./search-tool.js";
import { SPAPIDocsCrawler } from "./crawlers/sp-api-docs-crawler.js";
import { MCP_CACHE_DIR } from "../../utils/paths.js";

export interface SearchToolSetup {
  searchTool: SearchTool;
  indexManager: IndexManager;
  embeddingService: TransformersEmbeddingService;
}

/**
 * Creates and wires all search tool components.
 *
 * @param distDir - The __dirname of the compiled server (for locating pre-built index)
 */
export function createSearchTool(distDir: string): SearchToolSetup {
  const dataDir = join(MCP_CACHE_DIR, "contextual-search-tool");
  const prebuiltIndexPath = join(distDir, "data", "prebuilt-index");

  const embeddingService = new TransformersEmbeddingService();
  const vectorStore = new VectraVectorStore(join(dataDir, "index"));
  const indexManager = new IndexManager(
    {
      dataDir,
      prebuiltIndexPath,
      stalenessThresholdMs: 7 * 24 * 60 * 60 * 1000,
      chunkMaxTokens: 256,
      chunkOverlapTokens: 50,
    },
    vectorStore,
    embeddingService,
  );

  const docsCrawler = new SPAPIDocsCrawler(join(dataDir, "cache"));
  indexManager.registerCrawler("sp-api-docs", docsCrawler);

  const searchTool = new SearchTool(
    embeddingService,
    vectorStore,
    indexManager,
  );

  return { searchTool, indexManager, embeddingService };
}
