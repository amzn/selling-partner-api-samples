/**
 * JSON Input Type Schema
 *
 * Structured JSON input with schema reference support.
 * Designed for AI-assisted JSON generation based on external schemas.
 */

export const JSONSchema = {
  name: 'JSON',
  description: 'JSON input with schema reference for AI-assisted generation',

  fields: {
    SchemaPath: {
      type: 'string',
      required: false,
      description: 'Local file path to JSON schema (for AI to read and understand expected format)'
    },
    SchemaUrl: {
      type: 'string',
      required: false,
      description: 'URL to JSON schema (informational, AI should use SchemaPath for local access)'
    },
    MaxLength: {
      type: 'integer',
      default: 100000,
      description: 'Maximum JSON string length'
    },
    Pretty: {
      type: 'boolean',
      default: true,
      description: 'Pretty-print the JSON output'
    },
    ValidateSchema: {
      type: 'boolean',
      default: false,
      description: 'Validate input against schema (requires SchemaPath)'
    }
  },

  example: {
    Type: 'Input',
    InputType: 'JSON',
    Title: 'Listing Attributes',
    Description: 'Provide listing attributes in SP-API format',
    'SchemaPath.$': '$.schemaFile.path',
    MaxLength: 100000,
    Required: true,
    ResultPath: '$.listingAttributes',
    Next: 'CreateListing'
  },

  applyDefaults(state, config) {
    state.MaxLength = config.maxLength ?? 100000;
    state.Pretty = config.pretty ?? true;
    state.ValidateSchema = config.validateSchema ?? false;

    if (config.schemaPath) {
      state.SchemaPath = config.schemaPath;
    }

    if (config.schemaUrl) {
      state.SchemaUrl = config.schemaUrl;
    }
  },

  validate(stateName, stateConfig) {
    const errors = [];

    if (stateConfig.MaxLength !== undefined) {
      if (typeof stateConfig.MaxLength !== 'number' || stateConfig.MaxLength < 1) {
        errors.push(`${stateName}: MaxLength must be a positive integer`);
      }
    }

    if (stateConfig.ValidateSchema && !stateConfig.SchemaPath && !stateConfig['SchemaPath.$']) {
      errors.push(`${stateName}: ValidateSchema requires SchemaPath to be set`);
    }

    return errors;
  },

  validateValue(value, config) {
    // Handle objects directly (already parsed JSON)
    if (value !== null && typeof value === 'object') {
      // Already valid JSON object
      return { valid: true, parsed: value };
    }

    // Handle required check
    if (config.Required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return { valid: false, error: 'JSON input is required' };
    }

    // Empty is OK if not required
    if (!value || value === '') {
      return { valid: true };
    }

    // Must be a string at this point
    if (typeof value !== 'string') {
      return { valid: false, error: 'Value must be a JSON string or object' };
    }

    // Length validation
    const maxLength = config.MaxLength ?? 100000;
    if (value.length > maxLength) {
      return { valid: false, error: `JSON cannot exceed ${maxLength} characters` };
    }

    // Parse JSON
    try {
      const parsed = JSON.parse(value);
      return { valid: true, parsed };
    } catch (err) {
      return { valid: false, error: `Invalid JSON: ${err.message}` };
    }
  }
};
