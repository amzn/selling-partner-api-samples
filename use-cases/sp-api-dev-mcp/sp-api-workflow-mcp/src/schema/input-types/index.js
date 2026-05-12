/**
 * Input Types Registry
 *
 * Central registry for all input type schemas.
 * Each input type defines its schema, validation, and defaults.
 */

import { SingleSelectSchema } from './single-select.js';
import { MultiSelectSchema } from './multi-select.js';
import { BooleanSchema } from './boolean.js';
import { TextSchema } from './text.js';
import { NumberSchema } from './number.js';
import { DateSchema } from './date.js';
import { FormSchema } from './form.js';
import { ConfirmSchema } from './confirm.js';
import { TableSchema } from './table.js';
import { JSONSchema } from './json.js';

/**
 * Input type enumeration
 */
export const INPUT_TYPES = {
  SINGLE_SELECT: 'SingleSelect',
  MULTI_SELECT: 'MultiSelect',
  BOOLEAN: 'Boolean',
  TEXT: 'Text',
  NUMBER: 'Number',
  DATE: 'Date',
  FORM: 'Form',
  CONFIRM: 'Confirm',
  TABLE: 'Table',
  JSON: 'JSON'
};

/**
 * Registry of input type schemas
 */
const INPUT_TYPE_SCHEMAS = {
  SingleSelect: SingleSelectSchema,
  MultiSelect: MultiSelectSchema,
  Boolean: BooleanSchema,
  Text: TextSchema,
  Number: NumberSchema,
  Date: DateSchema,
  Form: FormSchema,
  Confirm: ConfirmSchema,
  Table: TableSchema,
  JSON: JSONSchema
};

/**
 * Get the schema for a specific input type
 *
 * @param {string} inputType - The input type name
 * @returns {object|null} The schema object or null if not found
 */
export function getInputTypeSchema(inputType) {
  return INPUT_TYPE_SCHEMAS[inputType] || null;
}

/**
 * Get all registered input types
 *
 * @returns {string[]} Array of input type names
 */
export function getAllInputTypes() {
  return Object.keys(INPUT_TYPE_SCHEMAS);
}

/**
 * Check if an input type is valid
 *
 * @param {string} inputType - The input type to check
 * @returns {boolean} True if valid
 */
export function isValidInputType(inputType) {
  return inputType in INPUT_TYPE_SCHEMAS;
}

/**
 * Get documentation for an input type
 *
 * @param {string} inputType - The input type name
 * @returns {object|null} Documentation object with description and examples
 */
export function getInputTypeDocumentation(inputType) {
  const schema = INPUT_TYPE_SCHEMAS[inputType];
  if (!schema) return null;

  return {
    type: inputType,
    description: schema.description,
    fields: schema.fields,
    example: schema.example
  };
}

/**
 * Validate a user's input value at runtime
 *
 * @param {string} inputType - The input type name
 * @param {any} value - The value to validate
 * @param {object} inputRequest - The input request configuration
 * @returns {object} { valid: boolean, error?: string }
 */
export function validateInputValue(inputType, value, inputRequest) {
  const schema = INPUT_TYPE_SCHEMAS[inputType];
  if (!schema) {
    return { valid: false, error: `Unknown input type: ${inputType}` };
  }

  if (!schema.validateValue) {
    // Schema doesn't define value validation, accept anything
    return { valid: true };
  }

  // Build config from inputRequest
  const config = {
    Required: inputRequest?.required ?? true,
    Options: inputRequest?.options,
    OptionValue: inputRequest?.optionValue,
    MinLength: inputRequest?.minLength,
    MaxLength: inputRequest?.maxLength,
    Pattern: inputRequest?.pattern,
    Min: inputRequest?.min,
    Max: inputRequest?.max,
    DecimalPlaces: inputRequest?.decimalPlaces,
    MinSelections: inputRequest?.minSelections,
    MaxSelections: inputRequest?.maxSelections,
    Fields: inputRequest?.fields,
    RequireTypedConfirmation: inputRequest?.requireTypedConfirmation,
    ConfirmationPhrase: inputRequest?.confirmationPhrase
  };

  // For select types, pass options as resolved options
  const resolvedOptions = inputRequest?.options;

  return schema.validateValue(value, config, resolvedOptions);
}

export {
  SingleSelectSchema,
  MultiSelectSchema,
  BooleanSchema,
  TextSchema,
  NumberSchema,
  DateSchema,
  FormSchema,
  ConfirmSchema,
  TableSchema,
  JSONSchema
};
