import { Parameter, isParameter, validateParameter } from "./parameter.js";

/**
 * Rate limit information for an API operation
 */
export interface RateLimit {
  /** Maximum requests allowed per second */
  requestsPerSecond?: number;
  /** Maximum requests allowed per minute */
  requestsPerMinute?: number;
  /** Maximum burst capacity */
  burst?: number;
  /** Time interval in seconds for rate limiting */
  intervalInSeconds?: number;
}

/**
 * Operation data model representing an API operation
 */
export interface Operation {
  /** The name of the operation */
  name: string;
  /** Description of what the operation does */
  description: string;
  /** How to call the operation */
  callMethod: string;
  /** Input parameters for the operation */
  inputParameters?: Parameter[];
  /** The model type returned by the operation */
  returnedModel: string;
  /** Rate limit information for the operation */
  rateLimit: RateLimit | null;
}

/**
 * Type guard to check if an object is a valid RateLimit
 */
export function isRateLimit(obj: any): obj is RateLimit {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const hasRequestsPerSecond = obj.requestsPerSecond !== undefined;
  const hasRequestsPerMinute = obj.requestsPerMinute !== undefined;

  // Must have at least one rate limit field
  if (!hasRequestsPerSecond && !hasRequestsPerMinute) {
    return false;
  }

  // If present, must be positive numbers
  if (
    hasRequestsPerSecond &&
    (typeof obj.requestsPerSecond !== "number" || obj.requestsPerSecond <= 0)
  ) {
    return false;
  }

  if (
    hasRequestsPerMinute &&
    (typeof obj.requestsPerMinute !== "number" || obj.requestsPerMinute <= 0)
  ) {
    return false;
  }

  // Validate burst if present
  if (
    obj.burst !== undefined &&
    (typeof obj.burst !== "number" || obj.burst <= 0)
  ) {
    return false;
  }

  // Validate intervalInSeconds if present
  if (
    obj.intervalInSeconds !== undefined &&
    (typeof obj.intervalInSeconds !== "number" || obj.intervalInSeconds <= 0)
  ) {
    return false;
  }

  return true;
}

/**
 * Type guard to check if an object is a valid Operation
 */
export function isOperation(obj: any): obj is Operation {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.name === "string" &&
    typeof obj.description === "string" &&
    typeof obj.callMethod === "string" &&
    typeof obj.returnedModel === "string" &&
    (obj.inputParameters === undefined ||
      (Array.isArray(obj.inputParameters) &&
        obj.inputParameters.every(isParameter))) &&
    (obj.rateLimit === null || isRateLimit(obj.rateLimit))
  );
}

/**
 * Validates a RateLimit object and returns validation errors if any
 */
export function validateRateLimit(obj: any): string[] {
  const errors: string[] = [];

  if (typeof obj !== "object" || obj === null) {
    errors.push("RateLimit must be an object");
    return errors;
  }

  const hasRequestsPerSecond = obj.requestsPerSecond !== undefined;
  const hasRequestsPerMinute = obj.requestsPerMinute !== undefined;

  if (!hasRequestsPerSecond && !hasRequestsPerMinute) {
    errors.push(
      "RateLimit must have at least one of requestsPerSecond or requestsPerMinute",
    );
  }

  if (hasRequestsPerSecond) {
    if (typeof obj.requestsPerSecond !== "number") {
      errors.push("RateLimit requestsPerSecond must be a number");
    } else if (obj.requestsPerSecond <= 0) {
      errors.push("RateLimit requestsPerSecond must be a positive number");
    }
  }

  if (hasRequestsPerMinute) {
    if (typeof obj.requestsPerMinute !== "number") {
      errors.push("RateLimit requestsPerMinute must be a number");
    } else if (obj.requestsPerMinute <= 0) {
      errors.push("RateLimit requestsPerMinute must be a positive number");
    }
  }

  if (obj.burst !== undefined) {
    if (typeof obj.burst !== "number") {
      errors.push("RateLimit burst must be a number");
    } else if (obj.burst <= 0) {
      errors.push("RateLimit burst must be a positive number");
    }
  }

  if (obj.intervalInSeconds !== undefined) {
    if (typeof obj.intervalInSeconds !== "number") {
      errors.push("RateLimit intervalInSeconds must be a number");
    } else if (obj.intervalInSeconds <= 0) {
      errors.push("RateLimit intervalInSeconds must be a positive number");
    }
  }

  return errors;
}

/**
 * Validates an Operation object and returns validation errors if any
 */
export function validateOperation(obj: any): string[] {
  const errors: string[] = [];

  if (typeof obj !== "object" || obj === null) {
    errors.push("Operation must be an object");
    return errors;
  }

  if (typeof obj.name !== "string" || obj.name.trim() === "") {
    errors.push("Operation name must be a non-empty string");
  }

  if (typeof obj.description !== "string") {
    errors.push("Operation description must be a string");
  }

  if (typeof obj.callMethod !== "string" || obj.callMethod.trim() === "") {
    errors.push("Operation callMethod must be a non-empty string");
  }

  if (
    typeof obj.returnedModel !== "string" ||
    obj.returnedModel.trim() === ""
  ) {
    errors.push("Operation returnedModel must be a non-empty string");
  }

  if (obj.inputParameters !== undefined) {
    if (!Array.isArray(obj.inputParameters)) {
      errors.push("Operation inputParameters must be an array if provided");
    } else {
      obj.inputParameters.forEach((param: any, index: number) => {
        const paramErrors = validateParameter(param);
        paramErrors.forEach((error) => {
          errors.push(`Parameter at index ${index}: ${error}`);
        });
      });
    }
  }

  if (obj.rateLimit !== null && obj.rateLimit !== undefined) {
    const rateLimitErrors = validateRateLimit(obj.rateLimit);
    rateLimitErrors.forEach((error) => {
      errors.push(`RateLimit: ${error}`);
    });
  }

  return errors;
}
