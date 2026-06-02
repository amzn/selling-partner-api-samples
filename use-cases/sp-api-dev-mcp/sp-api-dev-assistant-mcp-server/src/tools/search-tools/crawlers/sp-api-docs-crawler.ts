import axios from "axios";
import * as cheerio from "cheerio";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { RawDocument } from "../types.js";
import type { Crawler } from "./crawler-interface.js";
import { logger } from "../../../utils/logger.js";

export class SPAPIDocsCrawler implements Crawler {
  readonly name = "sp-api-docs";
  private baseUrl = "https://developer-docs.amazon.com/sp-api";
  private cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  getSourceMetadata() {
    return {
      name: this.name,
      baseUrl: this.baseUrl,
      supportedLocales: ["en-US"],
    };
  }

  async crawl(): Promise<RawDocument[]> {
    const documents: RawDocument[] = [];

    const pages = await this.discoverPages();
    for (const url of pages) {
      try {
        const doc = await this.fetchAndParsePage(url);
        if (doc) documents.push(doc);
      } catch (error) {
        logger.error(`Failed to fetch ${url}: ${error}`);
      }
    }

    return documents;
  }

  private async discoverPages(): Promise<string[]> {
    const docsUrl = `${this.baseUrl}/docs`;

    try {
      const html = await this.fetchPage(docsUrl);
      const $ = cheerio.load(html);
      const links: string[] = [];

      // Find all documentation links
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (href && href.includes("/sp-api") && href.includes("/docs/")) {
          const fullUrl = href.startsWith("http")
            ? href
            : `https://developer-docs.amazon.com${href}`;
          if (!links.includes(fullUrl)) {
            links.push(fullUrl);
          }
        }
      });

      return links.length > 0 ? links : [docsUrl];
    } catch (error) {
      logger.error(`Failed to discover pages: ${error}`);
      return [];
    }
  }

  private async fetchAndParsePage(url: string): Promise<RawDocument | null> {
    const html = await this.fetchPage(url);
    if (!html) return null;

    const $ = cheerio.load(html);
    const title =
      $("h1").first().text().trim() || $("title").text().trim() || "Untitled";
    const category = this.extractCategory(url);

    // Cache the raw HTML
    this.cacheHtml(url, html);

    return {
      url,
      title,
      htmlContent: html,
      sourceType: this.name,
      category,
      locale: "en-US",
    };
  }

  private async fetchPage(url: string): Promise<string> {
    // Check cache first
    const cached = this.getCachedHtml(url);
    if (cached) return cached;

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "SP-API-Dev-MCP-Indexer/1.0",
      },
    });
    return response.data;
  }

  private extractCategory(url: string): string {
    const match = url.match(/\/docs\/([^/]+)/);
    return match ? match[1] : "general";
  }

  private cacheHtml(url: string, html: string): void {
    try {
      const filename = this.urlToFilename(url);
      writeFileSync(join(this.cacheDir, filename), html, "utf-8");
    } catch (error) {
      logger.error(`Failed to cache HTML for ${url}: ${error}`);
    }
  }

  private getCachedHtml(url: string): string | null {
    try {
      const filename = this.urlToFilename(url);
      const filepath = join(this.cacheDir, filename);
      if (existsSync(filepath)) {
        return readFileSync(filepath, "utf-8");
      }
    } catch {
      // Cache miss, will fetch from network
    }
    return null;
  }

  private urlToFilename(url: string): string {
    return url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 200) + ".html";
  }
}
