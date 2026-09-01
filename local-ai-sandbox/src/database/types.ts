export { Api } from "./Context.js";

export interface DatabaseEngineConfig {
  mode: "memory" | "persistent";
  filePath?: string;
}

/**
 * Separator between the parts of a composite primary key. The spec constrains
 * neither seller IDs nor SKUs to exclude it, so a SKU containing this character
 * could in principle produce an ambiguous key; escaping the parts is the fix if
 * that ever matters in practice.
 */
const KEY_SEPARATOR = "|";

/**
 * Joins the parts of a composite primary key, in key order, for partitions
 * whose identifier is unique only within a scope — a listing's SKU is unique
 * per seller, not globally. Data fidelity, not access control: the sandbox
 * authenticates nobody.
 */
export function buildEntityKey(parts: string[]): string {
  return parts.join(KEY_SEPARATOR);
}

export interface StoredDocument {
  _key: string;
  _parentRef?: {
    domain: string;
    key: string;
  };
  [field: string]: any;
}

export interface DocumentMetadata {
  _key: string;
  _parentRef?: {
    domain: string;
    key: string;
  };
}

export interface FieldQuery {
  field: string; // Dot-notation path (e.g., "summaries.0.brandName")
  value: any; // Exact match value
  values?: any[]; // IN-style match (alternative to value)
}

export interface QueryOptions {
  fields?: string[]; // Projection: only return these fields
}

export interface RelationshipQuery {
  parentId?: string; // Find children of this parent
  childId?: string; // Find parent of this child
  parentDomain?: string; // Domain of the parent collection
  childDomain?: string; // Domain of the child collection
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class InvalidDomainError extends DatabaseError {
  constructor(domain: string) {
    super(`Invalid API domain: "${domain}"`, "INVALID_DOMAIN");
  }
}

export class InvalidKeyError extends DatabaseError {
  constructor(reason: string) {
    super(`Invalid document key: ${reason}`, "INVALID_KEY");
  }
}
