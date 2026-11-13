/**
 * Number Input Type Schema
 *
 * Numeric input with min/max bounds and step control.
 * Supports integers and decimals.
 */

export const NumberSchema = {
  name: 'Number',
  description: 'Numeric input with validation',

  fields: {
    Min: {
      type: 'number',
      required: false,
      description: 'Minimum allowed value'
    },
    Max: {
      type: 'number',
      required: false,
      description: 'Maximum allowed value'
    },
    Step: {
      type: 'number',
      default: 1,
      description: 'Increment/decrement step'
    },
    DecimalPlaces: {
      type: 'integer',
      default: 0,
      description: 'Number of decimal places allowed (0 for integers)'
    },
    Unit: {
      type: 'string',
      required: false,
      description: 'Unit label to display (e.g., "units", "USD", "kg")'
    },
    Placeholder: {
      type: 'string',
      required: false,
      description: 'Placeholder text when empty'
    }
  },

  example: {
    Type: 'Input',
    InputType: 'Number',
    Title: 'Replenishment Quantity',
    Description: 'How many units to order?',
    Min: 1,
    Max: 10000,
    Step: 10,
    DecimalPlaces: 0,
    Unit: 'units',
    Default: 100,
    Required: true,
    ResultPath: '$.replenishmentQuantity',
    Next: 'CalculateCost'
  },

  applyDefaults(state, config) {
    if (config.min !== undefined) {
      state.Min = config.min;
    }

    if (config.max !== undefined) {
      state.Max = config.max;
    }

    state.Step = config.step ?? 1;
    state.DecimalPlaces = config.decimalPlaces ?? 0;

    if (config.unit) {
      state.Unit = config.unit;
    }

    if (config.placeholder) {
      state.Placeholder = config.placeholder;
    }
  },

  validate(stateName, stateConfig) {
    const errors = [];

    if (stateConfig.Min !== undefined && typeof stateConfig.Min !== 'number') {
      errors.push(`${stateName}: Min must be a number`);
    }

    if (stateConfig.Max !== undefined && typeof stateConfig.Max !== 'number') {
      errors.push(`${stateName}: Max must be a number`);
    }

    if (stateConfig.Min !== undefined &&
        stateConfig.Max !== undefined &&
        stateConfig.Min > stateConfig.Max) {
      errors.push(`${stateName}: Min cannot be greater than Max`);
    }

    if (stateConfig.Step !== undefined) {
      if (typeof stateConfig.Step !== 'number' || stateConfig.Step <= 0) {
        errors.push(`${stateName}: Step must be a positive number`);
      }
    }

    if (stateConfig.DecimalPlaces !== undefined) {
      if (!Number.isInteger(stateConfig.DecimalPlaces) || stateConfig.DecimalPlaces < 0) {
        errors.push(`${stateName}: DecimalPlaces must be a non-negative integer`);
      }
    }

    return errors;
  },

  validateValue(value, config) {
    if (config.Required && (value === undefined || value === null || value === '')) {
      return { valid: false, error: 'A number is required' };
    }

    if (value === undefined || value === null || value === '') {
      return { valid: true };
    }

    // Convert string to number if needed
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (typeof numValue !== 'number' || isNaN(numValue)) {
      return { valid: false, error: 'Value must be a valid number' };
    }

    // Min/Max validation
    if (config.Min !== undefined && numValue < config.Min) {
      return { valid: false, error: `Value must be at least ${config.Min}` };
    }

    if (config.Max !== undefined && numValue > config.Max) {
      return { valid: false, error: `Value cannot exceed ${config.Max}` };
    }

    // Decimal places validation
    const decimalPlaces = config.DecimalPlaces ?? 0;
    if (decimalPlaces === 0 && !Number.isInteger(numValue)) {
      return { valid: false, error: 'Value must be a whole number' };
    }

    const decimalPart = numValue.toString().split('.')[1];
    if (decimalPart && decimalPart.length > decimalPlaces) {
      return { valid: false, error: `Value cannot have more than ${decimalPlaces} decimal places` };
    }

    return { valid: true, value: numValue };
  }
};
