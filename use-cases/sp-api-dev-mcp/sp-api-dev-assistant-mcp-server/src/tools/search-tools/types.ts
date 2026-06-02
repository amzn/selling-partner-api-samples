export interface DocumentChunkMetadata {
  title: string;
  sourceUrl: string;
  sourceType: string; // e.g., 'sp-api-docs'
  category: string; // e.g., 'orders-api', 'feeds-api'
  locale: string; // e.g., 'en-US', 'fr-FR'
  lastUpdated?: string; // ISO 8601
  chunkIndex: number; // position within the source document
}

export interface RawDocument {
  url: string;
  title: string;
  htmlContent: string;
  sourceType: string;
  category: string;
  locale: string;
  lastUpdated?: string; // ISO 8601
}

export interface IndexMetadata {
  lastSuccessfulIndex: string; // ISO 8601
  documentCount: number;
  crawlHistory: Array<{
    source: string;
    timestamp: string;
    documentsCrawled: number;
  }>;
}

export interface SearchResult {
  title: string;
  sourceUrl: string;
  sourceType: string;
  category: string;
  locale: string;
  relevanceScore: number;
  content: string;
}

export interface VectorStoreItem {
  id: string;
  text: string;
  metadata: DocumentChunkMetadata;
}

export interface ScoredItem {
  item: VectorStoreItem;
  score: number;
}

export interface VectorStoreFilters {
  locale?: string;
}

export interface IndexManagerConfig {
  dataDir: string;
  prebuiltIndexPath: string;
  stalenessThresholdMs: number;
  chunkMaxTokens: number;
  chunkOverlapTokens: number;
}

export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
