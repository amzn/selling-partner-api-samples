/**
 * Input State Schema
 *
 * Defines the schema for the custom Input state type.
 * Input states enable human-in-the-loop interactions within workflows.
 */

import { INPUT_TYPES, getInputTypeSchema } from './input-types/index.js';

/**
 * Valid input types
 */
export const VALID_INPUT_TYPES = [
  'SingleSelect',
  'MultiSelect',
  'Boolean',
  'Text',
  'Number',
  'Date',
  'Form',
  'Confirm',
  'Table',
  'JSON'
];

/**
 * Base Input state schema
 * All Input states must have these fields
 */
export const INPUT_STATE_BASE_SCHEMA = {
  Type: {
    type: 'string',
    const: 'Input',
    required: true
  },
  InputType: {
    type: 'string',
    enum: VALID_INPUT_TYPES,
    required: true,
    description: 'The type of input to collect from the user'
  },
  Title: {
    type: 'string',
    required: true,
    description: 'Title displayed to the user'
  },
  Description: {
    type: 'string',
    required: false,
    description: 'Help text or instructions for the user'
  },
  Required: {
    type: 'boolean',
    default: true,
    description: 'Whether input is required before proceeding'
  },
  Timeout: {
    type: 'integer',
    default: 3600,
    minimum: 1,
    maximum: 86400,
    description: 'Timeout in seconds (default: 1 hour, max: 24 hours)'
  },
  Default: {
    type: 'any',
    required: false,
    description: 'Default value if user does not provide input'
  },
  ResultPath: {
    type: 'string',
    required: true,
    pattern: '^\\$\\..*$',
    description: 'JSONPath where the user input will be stored'
  },
  Next: {
    type: 'string',
    required: false,
    description: 'Next state to transition to (mutually exclusive with End)'
  },
  End: {
    type: 'boolean',
    required: false,
    description: 'Whether this is a terminal state (mutually exclusive with Next)'
  }
};

/**
 * Create a complete Input state definition
 *
 * @param {string} inputType - Type of input (SingleSelect, MultiSelect, etc.)
 * @param {object} config - Configuration for the Input state
 * @returns {object} Complete Input state definition
 */
export function createInputState(inputType, config) {
  if (!VALID_INPUT_TYPES.includes(inputType)) {
    throw new Error(`Invalid input type: ${inputType}. Valid types: ${VALID_INPUT_TYPES.join(', ')}`);
  }

  const state = {
    Type: 'Input',
    InputType: inputType,
    Title: config.title,
    Required: config.required ?? true,
    Timeout: config.timeout ?? 3600,
    ResultPath: config.resultPath
  };

  if (config.description) {
    state.Description = config.description;
  }

  if (config.default !== undefined) {
    state.Default = config.default;
  }

  if (config.next) {
    state.Next = config.next;
  } else if (config.end) {
    state.End = true;
  } else {
    state.End = true; // Default to terminal state
  }

  // Add type-specific fields
  const typeSchema = getInputTypeSchema(inputType);
  if (typeSchema && typeSchema.applyDefaults) {
    typeSchema.applyDefaults(state, config);
  }

  return state;
}

/**
 * Validate an Input state definition
 *
 * @param {string} stateName - Name of the state
 * @param {object} stateConfig - State configuration to validate
 * @returns {object} Validation result with valid flag and errors array
 */
export function validateInputState(stateName, stateConfig) {
  const errors = [];

  // Validate required base fields
  if (stateConfig.Type !== 'Input') {
    errors.push(`${stateName}: Type must be 'Input'`);
  }

  if (!stateConfig.InputType) {
    errors.push(`${stateName}: InputType is required`);
  } else if (!VALID_INPUT_TYPES.includes(stateConfig.InputType)) {
    errors.push(`${stateName}: Invalid InputType '${stateConfig.InputType}'. Valid types: ${VALID_INPUT_TYPES.join(', ')}`);
  }

  if (!stateConfig.Title) {
    errors.push(`${stateName}: Title is required`);
  }

  if (!stateConfig.ResultPath) {
    errors.push(`${stateName}: ResultPath is required`);
  } else if (!stateConfig.ResultPath.startsWith('$.')) {
    errors.push(`${stateName}: ResultPath must be a valid JSONPath starting with $.`);
  }

  // Validate Next/End mutual exclusivity
  if (stateConfig.Next && stateConfig.End) {
    errors.push(`${stateName}: Cannot have both Next and End`);
  }

  if (!stateConfig.Next && !stateConfig.End) {
    errors.push(`${stateName}: Must have either Next or End`);
  }

  // Validate Timeout
  if (stateConfig.Timeout !== undefined) {
    if (typeof stateConfig.Timeout !== 'number' || stateConfig.Timeout < 1) {
      errors.push(`${stateName}: Timeout must be a positive integer`);
    }
    if (stateConfig.Timeout > 86400) {
      errors.push(`${stateName}: Timeout cannot exceed 86400 seconds (24 hours)`);
    }
  }

  // Validate type-specific fields
  if (stateConfig.InputType && VALID_INPUT_TYPES.includes(stateConfig.InputType)) {
    const typeSchema = getInputTypeSchema(stateConfig.InputType);
    if (typeSchema && typeSchema.validate) {
      const typeErrors = typeSchema.validate(stateName, stateConfig);
      errors.push(...typeErrors);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a state is an Input state
 *
 * @param {object} stateConfig - State configuration
 * @returns {boolean} True if this is an Input state
 */
export function isInputState(stateConfig) {
  return Boolean(stateConfig && stateConfig.Type === 'Input');
}

export { INPUT_TYPES };
