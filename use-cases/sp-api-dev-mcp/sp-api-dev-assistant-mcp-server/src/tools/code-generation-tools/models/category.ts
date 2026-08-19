/**
 * Category data model representing an API category grouping
 */
export interface Category {
  /** The name of the API */
  name: string;
  /** Description of what the API does */
  description: string;
  /** Path to the operations file */
  operationsPath: string;
  /** Path to the api models folder */
  modelsPath: string;
  /** Dependencies import method */
  importPath: string;
}

/**
 * Type guard to check if an object is a valid Category
 */
export function isCategory(obj: any): obj is Category {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.name === "string" &&
    typeof obj.description === "string" &&
    typeof obj.operationsPath === "string" &&
    typeof obj.modelsPath === "string" &&
    typeof obj.importPath === "string"
  );
}

/**
 * Validates a Category object and returns validation errors if any
 */
export function validateCategory(obj: any): string[] {
  const errors: string[] = [];

  if (typeof obj !== "object" || obj === null) {
    errors.push("Category must be an object");
    return errors;
  }

  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    errors.push("Category name must be a non-empty string");
  }

  if (typeof obj.description !== "string") {
    errors.push("Category description must be a string");
  }

  if (
    typeof obj.operationsPath !== "string" ||
    obj.operationsPath.trim() === ""
  ) {
    errors.push("Category operationsPath must be a non-empty string");
  }

  if (typeof obj.modelsPath !== "string" || obj.modelsPath.trim() === "") {
    errors.push("Category modelsPath must be a non-empty string");
  }

  if (typeof obj.importPath !== "string" || obj.importPath.trim() === "") {
    errors.push("Category importPath must be a non-empty string");
  }

  return errors;
}
