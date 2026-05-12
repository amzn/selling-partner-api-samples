import type { ToolResponse, SearchResult } from "./types.js";
import type { EmbeddingService } from "./embedding-service.js";
import type { VectorStore } from "./vector-store.js";
import type { IndexManager } from "./index-manager.js";

export interface SearchArgs {
  query: string;
  top_k?: number;
}

export class SearchTool {
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;
  private indexManager: IndexManager;

  constructor(
    embeddingService: EmbeddingService,
    vectorStore: VectorStore,
    indexManager: IndexManager,
  ) {
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
    this.indexManager = indexManager;
  }

  async search(args: SearchArgs): Promise<ToolResponse> {
    try {
      const hasIndex = await this.vectorStore.hasIndex();
      if (!hasIndex) {
        return {
          content: [
            {
              type: "text",
              text: "The SP-API documentation index has not been built yet. It will be built automatically on the next server startup. Please restart the MCP server and try again.",
            },
          ],
          isError: false,
        };
      }

      const topK = args.top_k ?? 5;

      const queryVector = await this.embeddingService.embed(args.query);

      const results = await this.vectorStore.search(queryVector, topK);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No results found for query: "${args.query}". The index may need to be refreshed.`,
            },
          ],
          isError: false,
        };
      }

      const formattedText = this.formatResults(
        args.query,
        results.map((r) => ({
          title: r.item.metadata.title,
          sourceUrl: r.item.metadata.sourceUrl,
          sourceType: r.item.metadata.sourceType,
          category: r.item.metadata.category,
          locale: r.item.metadata.locale,
          relevanceScore: r.score,
          content: r.item.text,
        })),
      );

      return {
        content: [{ type: "text", text: formattedText }],
        isError: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Search failed: ${message}` }],
        isError: true,
      };
    }
  }

  private formatResults(query: string, results: SearchResult[]): string {
    let md = `# 📚 SP-API Documentation Search Results\n\n`;
    md += `**Query:** "${query}"\n`;
    md += `**Results Found:** ${results.length}\n\n`;
    md += `---\n\n`;

    results.forEach((result, index) => {
      md += `## ${index + 1}. ${result.title}\n\n`;
      md += `**Relevance Score:** ${result.relevanceScore.toFixed(2)} | `;
      md += `**Category:** ${result.category} | **Locale:** ${result.locale}\n\n`;
      md += `🔗 [Source](${result.sourceUrl})\n\n`;
      md += `${result.content}\n\n`;
      md += `---\n\n`;
    });

    return md;
  }
}
