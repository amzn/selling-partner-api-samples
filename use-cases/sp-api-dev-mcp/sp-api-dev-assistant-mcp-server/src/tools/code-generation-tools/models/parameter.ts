/**
 * Parameter data model representing an input parameter for API operations
 */
export interface Parameter {
  /** The name of the parameter */
  name: string;
  /** Description of what the parameter does */
  description: string;
  /** The type of the parameter */
  type: string;
  /** Whether the parameter is required or not */
  required: boolean;
}

/**
 * Type guard to check if an object is a valid Parameter
 */
export function isParameter(obj: any): obj is Parameter {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.name === "string" &&
    typeof obj.description === "string" &&
    typeof obj.type === "string" &&
    typeof obj.required === "boolean"
  );
}

/**
 * Validates a Parameter object and returns validation errors if any
 */
export function validateParameter(obj: any): string[] {
  const errors: string[] = [];

  if (typeof obj !== "object" || obj === null) {
    errors.push("Parameter must be an object");
    return errors;
  }

  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    errors.push("Parameter name must be a non-empty string");
  }

  if (typeof obj.description !== "string") {
    errors.push("Parameter description must be a string");
  }

  if (typeof obj.type !== "string" || obj.type.trim() === "") {
    errors.push("Parameter type must be a non-empty string");
  }

  if (typeof obj.required !== "boolean") {
    errors.push("Parameter required must be a boolean");
  }

  return errors;
}
