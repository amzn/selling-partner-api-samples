/**
 * EmbeddingService wraps Transformers.js for local ONNX model inference.
 * Uses the multilingual-e5-small model (384 dimensions) for embedding text.
 */

import { pipeline as createPipeline } from "@huggingface/transformers";

export interface EmbeddingService {
  /** Generate a 384-dimension embedding vector for the given text (query prefix). */
  embed(text: string): Promise<number[]>;

  /** Generate a 384-dimension embedding vector for a document (passage prefix). */
  embedDocument(text: string): Promise<number[]>;

  /** Check if the model is loaded and ready. */
  isReady(): boolean;

  /** Pre-download and load the model. Call during server startup to avoid first-query delay. */
  preload(): Promise<void>;
}

export class TransformersEmbeddingService implements EmbeddingService {
  private pipeline: any | null = null;
  private modelId: string;
  private loadPromise: Promise<void> | null = null;

  constructor(modelId?: string) {
    this.modelId = modelId || "Xenova/multilingual-e5-small";
  }

  /**
   * Embed text with "query: " prefix (E5 model convention for search queries).
   * Lazy-loads the ONNX model on first call and caches it for session reuse.
   */
  async embed(text: string): Promise<number[]> {
    await this.ensureModel();
    const output = await this.pipeline!(`query: ${text}`, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data) as number[];
  }

  /**
   * Embed text with "passage: " prefix (E5 model convention for indexing documents).
   * Lazy-loads the ONNX model on first call and caches it for session reuse.
   */
  async embedDocument(text: string): Promise<number[]> {
    await this.ensureModel();
    const output = await this.pipeline!(`passage: ${text}`, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data) as number[];
  }

  /** Returns true if the model pipeline has been loaded into memory. */
  isReady(): boolean {
    return this.pipeline !== null;
  }

  /** Pre-download and load the model during server startup. */
  async preload(): Promise<void> {
    await this.ensureModel();
  }

  /**
   * Lazy-load the ONNX model on first use.
   * Concurrent calls share the same loading promise to avoid duplicate loads.
   */
  private async ensureModel(): Promise<void> {
    if (this.pipeline) return;
    if (this.loadPromise) {
      await this.loadPromise;
      return;
    }
    this.loadPromise = (async () => {
      this.pipeline = await createPipeline("feature-extraction", this.modelId);
    })();
    await this.loadPromise;
  }
}
