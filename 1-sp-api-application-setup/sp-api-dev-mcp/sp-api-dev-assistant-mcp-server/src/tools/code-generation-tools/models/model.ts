/**
 * Model data model representing an API data model or schema
 */
export interface Model {
  /** The name of the model */
  name: string;
  /** The swagger type of the model */
  swaggerType: Record<string, string>;
  /** The attribute map of the model */
  attributeMap: Record<string, string>;
  /** Whether the model is an enum or not */
  isEnum: boolean;
  /** The enum values of the model (only present if isEnum is true) */
  enumValues?: string[];
}

/**
 * Type guard to check if an object is a valid Model
 */
export function isModel(obj: any): obj is Model {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.name === "string" &&
    typeof obj.swaggerType === "object" &&
    obj.swaggerType !== null &&
    typeof obj.attributeMap === "object" &&
    obj.attributeMap !== null &&
    typeof obj.isEnum === "boolean" &&
    (obj.enumValues === undefined ||
      (Array.isArray(obj.enumValues) &&
        obj.enumValues.every((val: any) => typeof val === "string")))
  );
}

/**
 * Validates a Model object and returns validation errors if any
 */
export function validateModel(obj: any): string[] {
  const errors: string[] = [];

  if (typeof obj !== "object" || obj === null) {
    errors.push("Model must be an object");
    return errors;
  }

  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    errors.push("Model name must be a non-empty string");
  }

  if (typeof obj.swaggerType !== "object" || obj.swaggerType === null) {
    errors.push("Model swaggerType must be an object");
  } else {
    // Validate that all values in swaggerType are strings
    for (const [key, value] of Object.entries(obj.swaggerType)) {
      if (typeof value !== "string") {
        errors.push(`Model swaggerType[${key}] must be a string`);
      }
    }
  }

  if (typeof obj.attributeMap !== "object" || obj.attributeMap === null) {
    errors.push("Model attributeMap must be an object");
  } else {
    // Validate that all values in attributeMap are strings
    for (const [key, value] of Object.entries(obj.attributeMap)) {
      if (typeof value !== "string") {
        errors.push(`Model attributeMap[${key}] must be a string`);
      }
    }
  }

  if (typeof obj.isEnum !== "boolean") {
    errors.push("Model isEnum must be a boolean");
  }

  if (obj.enumValues !== undefined) {
    if (!Array.isArray(obj.enumValues)) {
      errors.push("Model enumValues must be an array if provided");
    } else {
      obj.enumValues.forEach((value: any, index: number) => {
        if (typeof value !== "string") {
          errors.push(`Model enumValues[${index}] must be a string`);
        }
      });
    }
  }

  // Validate enum consistency
  if (
    obj.isEnum === true &&
    (obj.enumValues === undefined || obj.enumValues.length === 0)
  ) {
    errors.push(
      "Model marked as enum must have enumValues array with at least one value",
    );
  }

  return errors;
}
