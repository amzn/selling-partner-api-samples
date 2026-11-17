/**
 * Filtering utilities for code generation tools
 */

/**
 * Parse comma-separated filter string into array of trimmed values
 * @param filterString - Comma-separated string to parse
 * @returns Array of trimmed, non-empty values
 */
export function parseFilterString(filterString: string): string[] {
  if (!filterString || filterString.trim() === "") {
    return [];
  }

  return filterString
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/**
 * Filter array of items by name (case-insensitive)
 * @param items - Array of items with name property
 * @param names - Array of names to filter by
 * @returns Filtered array containing only items matching the names
 */
export function filterByNames<T extends { name: string }>(
  items: T[],
  names: string[],
): T[] {
  if (!names || names.length === 0) {
    return items;
  }

  const lowerNames = names.map((name) => name.toLowerCase());

  return items.filter((item) => lowerNames.includes(item.name.toLowerCase()));
}

/**
 * Project object to include only specified fields
 * @param item - Object to project
 * @param fields - Array of field names to include
 * @param validFields - Array of valid field names (for validation)
 * @returns New object with only specified fields
 */
export function projectFields<T extends Record<string, any>>(
  item: T,
  fields: string[],
  validFields: string[],
): Partial<T> {
  const result: Partial<T> = {};

  for (const field of fields) {
    if (validFields.includes(field) && field in item) {
      result[field as keyof T] = item[field];
    }
  }

  return result;
}

/**
 * Validate field names against allowed fields
 * @param fields - Array of field names to validate
 * @param validFields - Array of valid field names
 * @returns Validation result with valid flag and list of invalid fields
 */
export function validateFields(
  fields: string[],
  validFields: string[],
): { valid: boolean; invalidFields: string[] } {
  const invalidFields = fields.filter((field) => !validFields.includes(field));

  return {
    valid: invalidFields.length === 0,
    invalidFields,
  };
}
