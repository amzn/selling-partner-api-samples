import Loki from "lokijs";
import { Api, type DatabaseEngineConfig, InvalidDomainError, InvalidKeyError } from "./types.js";
import { TriggerProcessor } from "../trigger/TriggerProcessor.js";
import { dbNamespaces } from "../registry/operationRegistry.js";

type DocumentRecord = Record<string, unknown>;

/** Write options. `silent` skips data-event emission, so no triggers fire. */
export interface WriteOptions {
  silent?: boolean;
}

/**
 * Core database engine wrapping LokiJS with typed CRUD operations,
 * domain validation, and pluggable persistence.
 */
export class DatabaseEngine {
  private db: Loki;
  private collections: Map<string, Collection<DocumentRecord>>;
  private domains: Set<string>;

  constructor(config: DatabaseEngineConfig) {
    this.collections = new Map();
    this.domains = new Set();

    if (config.mode === "persistent" && config.filePath) {
      this.db = new Loki(config.filePath, {
        autoload: true,
        autoloadCallback: this.initialize,
        autosave: true,
        autosaveInterval: 4000,
        persistenceMethod: "fs",
      });
    } else {
      this.db = new Loki("database.db");
      this.initialize();
    }
  }

  /**
   * Initialize all collections for known API domains.
   * Creates a LokiJS collection per domain with a unique index on `_key`.
   * In persistent mode, loads existing data from the storage file first.
   */
  public initialize = () => {
    this.domains = new Set(dbNamespaces());

    for (const domain of dbNamespaces()) {
      let collection: Collection<DocumentRecord> = this.db.getCollection(domain);
      collection ??= this.db.addCollection<DocumentRecord>(domain, { unique: ["_key"] });
      this.collections.set(domain, collection);
    }
  };

  /**
   * Get a typed collection by domain name.
   * Returns null if the domain has no associated collection.
   */
  getCollection(domain: Api): Collection<DocumentRecord> | null {
    return this.collections.get(domain) ?? null;
  }

  /**
   * Insert or overwrite a document by key (upsert).
   * Emits an INSERT or UPDATE data event unless `{ silent: true }` is passed.
   * Triggers run detached, so the write returns without waiting for them.
   * Throws InvalidDomainError if domain is not initialized.
   * Throws InvalidKeyError if key is null, undefined, or empty.
   */
  put(domain: Api, key: string, document: DocumentRecord, options: WriteOptions = {}): void {
    this.validateDomain(domain);
    this.validateKey(key);

    const collection = this.getValidatedCollection(domain);
    const existing = collection.by("_key", key);
    // `existing` is the live LokiJS object, so copy it out before overwriting.
    const previous = existing ? this.stripInternalFields(existing) : undefined;

    if (existing) {
      // Remove all non-internal fields from the existing document
      for (const prop of Object.keys(existing)) {
        if (prop !== "$loki" && prop !== "meta" && prop !== "_key") {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete (existing as Record<string, unknown>)[prop];
        }
      }
      // Apply new document fields
      Object.assign(existing, document, { _key: key });
      collection.update(existing);
    } else {
      collection.insert({ ...document, _key: key });
    }

    if (!options.silent) {
      this.emitDetached(previous ? "UPDATE" : "INSERT", domain, key, this.get(domain, key) ?? undefined, previous);
    }
  }

  /**
   * Retrieve a document by key.
   * Returns a clean copy without LokiJS internal fields, or null if not found.
   */
  get(domain: Api, key: string): DocumentRecord | null {
    this.validateDomain(domain);
    this.validateKey(key);

    const collection = this.getValidatedCollection(domain);
    const result = collection.by("_key", key);

    if (!result) {
      return null;
    }

    return this.stripInternalFields(result);
  }

  /**
   * Find matching documents for domain and query.
   * Returns a clean copy without LokiJS internal fields.
   */
  find(domain: Api, query: LokiQuery<Record<string, unknown>>): DocumentRecord[] {
    const collection = this.getValidatedCollection(domain);
    const docs = collection.find(query);
    return docs.map((doc) => this.stripInternalFields(doc));
  }

  /**
   * Remove a document by key.
   * Emits a DELETE data event unless `{ silent: true }` is passed.
   * Triggers run detached, exactly as for put, so the write returns without
   * waiting for them.
   * Returns true regardless of whether the key existed (desired end state achieved).
   */
  remove(domain: Api, key: string, options: WriteOptions = {}): Promise<boolean> {
    // Kept promise-returning (rather than async) so callers and existing
    // tests keep the awaitable contract, while validation errors still
    // surface as a rejection rather than a synchronous throw.
    try {
      this.validateDomain(domain);
      this.validateKey(key);

      const collection = this.getValidatedCollection(domain);
      const existing = collection.by("_key", key);

      if (existing) {
        const previous = this.stripInternalFields(existing);
        collection.remove(existing);
        if (!options.silent) {
          this.emitDetached("DELETE", domain, key, undefined, previous);
        }
      }
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Queues a data event for a later tick so the originating write returns
   * first: trigger handlers are the sandbox analogue of Amazon's
   * asynchronous downstream processing. Used by every write path, so
   * INSERT, UPDATE and DELETE all have the same trigger semantics.
   */
  private emitDetached(
    type: "INSERT" | "UPDATE" | "DELETE",
    domain: Api,
    key: string,
    entity: DocumentRecord | undefined,
    previous: DocumentRecord | undefined,
  ): void {
    setImmediate(() => {
      void TriggerProcessor.emit(type, domain, key, entity, previous).catch((error: unknown) => {
        console.error("[Trigger] Unhandled failure processing %s for %s:%s", type, domain, key, error);
      });
    });
  }

  /**
   * Batch retrieve documents by keys.
   * Returns a Map with the document (or null) for each requested key.
   */
  getBatch(domain: Api, keys: string[]): Map<string, DocumentRecord | null> {
    this.validateDomain(domain);

    const result = new Map<string, DocumentRecord | null>();
    const collection = this.getValidatedCollection(domain);

    for (const key of keys) {
      this.validateKey(key);
      const doc = collection.by("_key", key);
      result.set(key, doc ? this.stripInternalFields(doc) : null);
    }

    return result;
  }

  /**
   * Clear all data from all collections.
   */
  clear(): void {
    for (const collection of this.collections.values()) {
      collection.clear();
    }
  }

  /**
   * Get a collection that is guaranteed to exist (called after validateDomain).
   */
  private getValidatedCollection(domain: Api): Collection<DocumentRecord> {
    const collection = this.collections.get(domain);
    if (!collection) {
      throw new InvalidDomainError(domain);
    }
    return collection;
  }

  /**
   * Validate that the domain is one of the initialized domains.
   */
  private validateDomain(domain: Api): void {
    if (!this.domains.has(domain)) {
      throw new InvalidDomainError(domain);
    }
  }

  /**
   * Validate that the key is non-null, non-undefined, and non-empty.
   */
  private validateKey(key: string | null | undefined): void {
    if (key == null || key === "") {
      const reason = key == null ? "key is null or undefined" : "key is empty";
      throw new InvalidKeyError(reason);
    }
  }

  /**
   * Strip LokiJS internal fields ($loki, meta) from a document.
   */
  private stripInternalFields(doc: DocumentRecord): DocumentRecord {
    const result: DocumentRecord = {};
    for (const [key, value] of Object.entries(doc)) {
      if (key !== "$loki" && key !== "meta") {
        result[key] = value;
      }
    }
    return result;
  }
}
