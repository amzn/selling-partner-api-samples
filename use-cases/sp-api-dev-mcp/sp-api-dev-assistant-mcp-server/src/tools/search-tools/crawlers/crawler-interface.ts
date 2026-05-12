import type { RawDocument } from "../types.js";

export interface Crawler {
  /** Unique name for this crawler (e.g., 'sp-api-docs') */
  readonly name: string;

  /** Crawl the data source and return raw documents */
  crawl(): Promise<RawDocument[]>;

  /** Get metadata about this crawler's source */
  getSourceMetadata(): {
    name: string;
    baseUrl: string;
    supportedLocales: string[];
  };
}
