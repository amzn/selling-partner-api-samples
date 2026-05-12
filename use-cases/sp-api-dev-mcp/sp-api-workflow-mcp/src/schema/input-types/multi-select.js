/**
 * MultiSelect Input Type Schema
 *
 * Allows user to select one or more options from a list.
 * Options can be static or dynamically loaded via JSONPath.
 */

export const MultiSelectSchema = {
  name: 'MultiSelect',
  description: 'Select one or more options from a list',

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
    MinSelections: {
      type: 'integer',
      default: 1,
      description: 'Minimum number of selections required'
    },
    MaxSelections: {
      type: 'integer',
      required: false,
      description: 'Maximum number of selections allowed (unlimited if not specified)'
    },
    Searchable: {
      type: 'boolean',
      default: false,
      description: 'Enable search/filter functionality'
    },
    SelectAll: {
      type: 'boolean',
      default: false,
      description: 'Show a "Select All" option'
    }
  },

  example: {
    Type: 'Input',
    InputType: 'MultiSelect',
    Title: 'Select SKUs to Replenish',
    Description: 'Choose which SKUs to include in the replenishment order',
    'Options.$': '$.lowInventorySKUs',
    OptionLabel: 'sku',
    OptionDescription: 'productName',
    MinSelections: 1,
    MaxSelections: 10,
    Required: true,
    ResultPath: '$.selectedSKUs',
    Next: 'CreateReplenishmentOrder'
  },

  applyDefaults(state, config) {
    if (config.optionsPath) {
      state['Options.$'] = config.optionsPath;
    } else if (config.options) {
      state.Options = config.options;
    }

    if (config.optionLabel) {
      state.OptionLabel = config.optionLabel;
    }

    if (config.optionValue) {
      state.OptionValue = config.optionValue;
    }

    if (config.optionDescription) {
      state.OptionDescription = config.optionDescription;
    }

    if (config.minSelections !== undefined) {
      state.MinSelections = config.minSelections;
    }

    if (config.maxSelections !== undefined) {
      state.MaxSelections = config.maxSelections;
    }

    if (config.searchable !== undefined) {
      state.Searchable = config.searchable;
    }

    if (config.selectAll !== undefined) {
      state.SelectAll = config.selectAll;
    }
  },

  validate(stateName, stateConfig) {
    const errors = [];

    const hasStaticOptions = stateConfig.Options !== undefined;
    const hasDynamicOptions = stateConfig['Options.$'] !== undefined;

    if (!hasStaticOptions && !hasDynamicOptions) {
      errors.push(`${stateName}: MultiSelect requires either Options or Options.$ field`);
    }

    if (hasStaticOptions && hasDynamicOptions) {
      errors.push(`${stateName}: Cannot have both Options and Options.$`);
    }

    if (hasStaticOptions && !Array.isArray(stateConfig.Options)) {
      errors.push(`${stateName}: Options must be an array`);
    }

    if (!stateConfig.OptionLabel) {
      errors.push(`${stateName}: OptionLabel is required for MultiSelect`);
    }

    // Validate min/max selections
    if (stateConfig.MinSelections !== undefined && stateConfig.MinSelections < 0) {
      errors.push(`${stateName}: MinSelections cannot be negative`);
    }

    if (stateConfig.MaxSelections !== undefined && stateConfig.MaxSelections < 1) {
      errors.push(`${stateName}: MaxSelections must be at least 1`);
    }

    if (stateConfig.MinSelections !== undefined &&
        stateConfig.MaxSelections !== undefined &&
        stateConfig.MinSelections > stateConfig.MaxSelections) {
      errors.push(`${stateName}: MinSelections cannot be greater than MaxSelections`);
    }

    return errors;
  },

  validateValue(value, config) {
    if (config.Required && (!value || (Array.isArray(value) && value.length === 0))) {
      return { valid: false, error: 'At least one selection is required' };
    }

    if (!value || !Array.isArray(value)) {
      if (config.Required) {
        return { valid: false, error: 'Selection must be an array' };
      }
      return { valid: true };
    }

    const minSelections = config.MinSelections ?? 1;
    const maxSelections = config.MaxSelections;

    if (value.length < minSelections) {
      return { valid: false, error: `At least ${minSelections} selection(s) required` };
    }

    if (maxSelections !== undefined && value.length > maxSelections) {
      return { valid: false, error: `Maximum ${maxSelections} selection(s) allowed` };
    }

    return { valid: true };
  }
};
