import { LocalIndex } from "vectra";
import type {
  VectorStoreItem,
  ScoredItem,
  VectorStoreFilters,
} from "./types.js";

export interface VectorStore {
  search(
    queryVector: number[],
    topK: number,
    filters?: VectorStoreFilters,
  ): Promise<ScoredItem[]>;
  upsert(item: VectorStoreItem, vector: number[]): Promise<void>;
  clear(): Promise<void>;
  hasIndex(): Promise<boolean>;
  count(): Promise<number>;
}

export class VectraVectorStore implements VectorStore {
  private indexPath: string;
  private index: LocalIndex | null = null;

  constructor(indexPath: string) {
    this.indexPath = indexPath;
  }

  async search(
    queryVector: number[],
    topK: number,
    filters?: VectorStoreFilters,
  ): Promise<ScoredItem[]> {
    const index = await this.ensureIndex();

    let filter: Record<string, unknown> | undefined = undefined;
    if (filters?.locale) {
      filter = { locale: { $eq: filters.locale } };
    }

    const results = await index.queryItems(queryVector, "", topK, filter);

    return results.map((r) => ({
      item: {
        id: r.item.id,
        text: r.item.metadata.text as string,
        metadata: {
          title: r.item.metadata.title as string,
          sourceUrl: r.item.metadata.sourceUrl as string,
          sourceType: r.item.metadata.sourceType as string,
          category: r.item.metadata.category as string,
          locale: r.item.metadata.locale as string,
          lastUpdated: r.item.metadata.lastUpdated as string | undefined,
          chunkIndex: r.item.metadata.chunkIndex as number,
        },
      },
      score: r.score,
    }));
  }

  async upsert(item: VectorStoreItem, vector: number[]): Promise<void> {
    const index = await this.ensureIndex();

    const metadata: Record<string, string | number | boolean> = {
      text: item.text,
      title: item.metadata.title,
      sourceUrl: item.metadata.sourceUrl,
      sourceType: item.metadata.sourceType,
      category: item.metadata.category,
      locale: item.metadata.locale,
      chunkIndex: item.metadata.chunkIndex,
    };
    if (item.metadata.lastUpdated) {
      metadata.lastUpdated = item.metadata.lastUpdated;
    }

    await index.upsertItem({
      id: item.id,
      vector,
      metadata,
    });
  }

  async clear(): Promise<void> {
    const index = await this.ensureIndex();
    const items = await index.listItems();
    for (const item of items) {
      await index.deleteItem(item.id);
    }
  }

  async hasIndex(): Promise<boolean> {
    try {
      const index = await this.ensureIndex();
      const items = await index.listItems();
      return items.length > 0;
    } catch {
      return false;
    }
  }

  async count(): Promise<number> {
    try {
      const index = await this.ensureIndex();
      const items = await index.listItems();
      return items.length;
    } catch {
      return 0;
    }
  }

  private async ensureIndex(): Promise<LocalIndex> {
    if (this.index) return this.index;
    this.index = new LocalIndex(this.indexPath);
    if (!(await this.index.isIndexCreated())) {
      await this.index.createIndex();
    }
    return this.index;
  }
}
