/**
 * Text Input Type Schema
 *
 * Free-form text input with optional validation.
 * Supports single-line and multi-line input.
 */

export const TextSchema = {
  name: 'Text',
  description: 'Free-form text input with optional validation',

  fields: {
    MinLength: {
      type: 'integer',
      default: 0,
      description: 'Minimum text length'
    },
    MaxLength: {
      type: 'integer',
      default: 1000,
      description: 'Maximum text length'
    },
    Pattern: {
      type: 'string',
      required: false,
      description: 'Regular expression pattern for validation'
    },
    PatternError: {
      type: 'string',
      required: false,
      description: 'Custom error message when pattern validation fails'
    },
    Multiline: {
      type: 'boolean',
      default: false,
      description: 'Allow multi-line input (textarea vs input)'
    },
    Placeholder: {
      type: 'string',
      required: false,
      description: 'Placeholder text shown when empty'
    },
    Rows: {
      type: 'integer',
      default: 3,
      description: 'Number of visible rows for multiline input'
    }
  },

  example: {
    Type: 'Input',
    InputType: 'Text',
    Title: 'Shipment Notes',
    Description: 'Add any special instructions for this shipment',
    Placeholder: 'Enter notes here...',
    Multiline: true,
    Rows: 5,
    MaxLength: 500,
    Required: false,
    ResultPath: '$.shipmentNotes',
    Next: 'CreateShipment'
  },

  applyDefaults(state, config) {
    state.MinLength = config.minLength ?? 0;
    state.MaxLength = config.maxLength ?? 1000;

    if (config.pattern) {
      state.Pattern = config.pattern;
    }

    if (config.patternError) {
      state.PatternError = config.patternError;
    }

    state.Multiline = config.multiline ?? false;

    if (config.placeholder) {
      state.Placeholder = config.placeholder;
    }

    if (config.multiline && config.rows) {
      state.Rows = config.rows;
    }
  },

  validate(stateName, stateConfig) {
    const errors = [];

    if (stateConfig.MinLength !== undefined) {
      if (typeof stateConfig.MinLength !== 'number' || stateConfig.MinLength < 0) {
        errors.push(`${stateName}: MinLength must be a non-negative integer`);
      }
    }

    if (stateConfig.MaxLength !== undefined) {
      if (typeof stateConfig.MaxLength !== 'number' || stateConfig.MaxLength < 1) {
        errors.push(`${stateName}: MaxLength must be a positive integer`);
      }
    }

    if (stateConfig.MinLength !== undefined &&
        stateConfig.MaxLength !== undefined &&
        stateConfig.MinLength > stateConfig.MaxLength) {
      errors.push(`${stateName}: MinLength cannot be greater than MaxLength`);
    }

    if (stateConfig.Pattern) {
      try {
        new RegExp(stateConfig.Pattern);
      } catch (e) {
        errors.push(`${stateName}: Pattern is not a valid regular expression`);
      }
    }

    if (stateConfig.Rows !== undefined) {
      if (typeof stateConfig.Rows !== 'number' || stateConfig.Rows < 1) {
        errors.push(`${stateName}: Rows must be a positive integer`);
      }
    }

    return errors;
  },

  validateValue(value, config) {
    // Convert objects to JSON strings (useful for JSON input)
    let textValue = value;
    if (value !== null && typeof value === 'object') {
      textValue = JSON.stringify(value);
    }

    // Handle required check
    if (config.Required && (!textValue || (typeof textValue === 'string' && textValue.trim() === ''))) {
      return { valid: false, error: 'Text input is required' };
    }

    // Empty is OK if not required
    if (!textValue || textValue === '') {
      return { valid: true };
    }

    if (typeof textValue !== 'string') {
      return { valid: false, error: 'Value must be a string' };
    }

    // Use converted value for remaining checks
    value = textValue;

    // Length validation
    const minLength = config.MinLength ?? 0;
    const maxLength = config.MaxLength ?? 1000;

    if (value.length < minLength) {
      return { valid: false, error: `Text must be at least ${minLength} characters` };
    }

    if (value.length > maxLength) {
      return { valid: false, error: `Text cannot exceed ${maxLength} characters` };
    }

    // Pattern validation
    if (config.Pattern) {
      const regex = new RegExp(config.Pattern);
      if (!regex.test(value)) {
        const errorMsg = config.PatternError || 'Text does not match required format';
        return { valid: false, error: errorMsg };
      }
    }

    return { valid: true };
  }
};
