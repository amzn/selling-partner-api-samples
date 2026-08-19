/**
 * SingleSelect Input Type Schema
 *
 * Allows user to select exactly one option from a list.
 * Options can be static or dynamically loaded via JSONPath.
 */

export const SingleSelectSchema = {
  name: 'SingleSelect',
  description: 'Select exactly one option from a list',

  fields: {
    Options: {
      type: 'array',
      required: false,
      description: 'Static array of options to choose from'
    },
    'Options.$': {
      type: 'string',
      required: false,
      description: 'JSONPath to dynamically load options from workflow state'
    },
    OptionLabel: {
      type: 'string',
      required: true,
      description: 'Field name to display as the option label'
    },
    OptionValue: {
      type: 'string',
      required: false,
      description: 'Field name to use as the selection value (defaults to entire object)'
    },
    OptionDescription: {
      type: 'string',
      required: false,
      description: 'Field name to display as additional description'
    },
    MinOptions: {
      type: 'integer',
      default: 1,
      description: 'Minimum number of options required (validation)'
    },
    MaxOptions: {
      type: 'integer',
      default: 100,
      description: 'Maximum number of options to display'
    },
    Searchable: {
      type: 'boolean',
      default: false,
      description: 'Enable search/filter functionality for large option lists'
    }
  },

  example: {
    Type: 'Input',
    InputType: 'SingleSelect',
    Title: 'Select Packing Option',
    Description: 'Choose how items should be packed for shipment',
    'Options.$': '$.packingOptions.packingOptions',
    OptionLabel: 'packingOptionId',
    OptionDescription: 'description',
    Required: true,
    Timeout: 3600,
    ResultPath: '$.userSelection.packingOption',
    Next: 'ConfirmPackingOption'
  },

  /**
   * Apply default values for SingleSelect fields
   */
  applyDefaults(state, config) {
    // Options - either static or dynamic
    if (config.optionsPath) {
      state['Options.$'] = config.optionsPath;
    } else if (config.options) {
      state.Options = config.options;
    }

    // Required fields
    if (config.optionLabel) {
      state.OptionLabel = config.optionLabel;
    }

    // Optional fields
    if (config.optionValue) {
      state.OptionValue = config.optionValue;
    }

    if (config.optionDescription) {
      state.OptionDescription = config.optionDescription;
    }

    if (config.searchable !== undefined) {
      state.Searchable = config.searchable;
    }

    if (config.minOptions !== undefined) {
      state.MinOptions = config.minOptions;
    }

    if (config.maxOptions !== undefined) {
      state.MaxOptions = config.maxOptions;
    }
  },

  /**
   * Validate SingleSelect-specific fields
   */
  validate(stateName, stateConfig) {
    const errors = [];

    // Must have either Options or Options.$
    const hasStaticOptions = stateConfig.Options !== undefined;
    const hasDynamicOptions = stateConfig['Options.$'] !== undefined;

    if (!hasStaticOptions && !hasDynamicOptions) {
      errors.push(`${stateName}: SingleSelect requires either Options or Options.$ field`);
    }

    if (hasStaticOptions && hasDynamicOptions) {
      errors.push(`${stateName}: Cannot have both Options and Options.$ - use one or the other`);
    }

    // Validate static options
    if (hasStaticOptions) {
      if (!Array.isArray(stateConfig.Options)) {
        errors.push(`${stateName}: Options must be an array`);
      } else if (stateConfig.Options.length === 0) {
        errors.push(`${stateName}: Options array cannot be empty`);
      }
    }

    // Validate dynamic options path
    if (hasDynamicOptions) {
      if (typeof stateConfig['Options.$'] !== 'string') {
        errors.push(`${stateName}: Options.$ must be a string JSONPath`);
      } else if (!stateConfig['Options.$'].startsWith('$.')) {
        errors.push(`${stateName}: Options.$ must be a valid JSONPath starting with $.`);
      }
    }

    // OptionLabel is required
    if (!stateConfig.OptionLabel) {
      errors.push(`${stateName}: OptionLabel is required for SingleSelect`);
    }

    return errors;
  },

  /**
   * Validate a user's selection at runtime
   */
  validateValue(value, config, resolvedOptions) {
    if (config.Required && (value === undefined || value === null)) {
      return { valid: false, error: 'Selection is required' };
    }

    if (value === undefined || value === null) {
      return { valid: true };
    }

    // Check if selection is in the options
    const options = resolvedOptions || config.Options || [];
    const valueField = config.OptionValue;

    let validValues;
    if (valueField) {
      validValues = options.map(opt => opt[valueField]);
    } else {
      // If no OptionValue specified, compare values directly
      // For primitive values (strings, numbers), compare directly
      // For objects, use JSON.stringify for comparison
      const hasPrimitiveOptions = options.length > 0 && typeof options[0] !== 'object';
      if (hasPrimitiveOptions) {
        validValues = options;
        if (!validValues.includes(value)) {
          return { valid: false, error: 'Invalid selection' };
        }
        return { valid: true };
      } else {
        // Object comparison using JSON
        validValues = options.map(opt => JSON.stringify(opt));
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
        if (!validValues.includes(valueStr)) {
          return { valid: false, error: 'Invalid selection' };
        }
        return { valid: true };
      }
    }

    if (!validValues.includes(value)) {
      return { valid: false, error: `Invalid selection: ${value}` };
    }

    return { valid: true };
  }
};
