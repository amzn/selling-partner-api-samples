/**
 * Boolean Input Type Schema
 *
 * Simple yes/no or true/false input.
 * Labels are customizable.
 */

export const BooleanSchema = {
  name: 'Boolean',
  description: 'Simple yes/no or true/false selection',

  fields: {
    TrueLabel: {
      type: 'string',
      default: 'Yes',
      description: 'Label for the true/yes option'
    },
    FalseLabel: {
      type: 'string',
      default: 'No',
      description: 'Label for the false/no option'
    },
    DefaultValue: {
      type: 'boolean',
      required: false,
      description: 'Pre-selected value (true or false)'
    }
  },

  example: {
    Type: 'Input',
    InputType: 'Boolean',
    Title: 'Proceed with Shipment?',
    Description: 'Do you want to proceed with creating the shipment?',
    TrueLabel: 'Yes, create shipment',
    FalseLabel: 'No, cancel',
    Required: true,
    ResultPath: '$.userConfirmation.proceed',
    Next: 'CheckConfirmation'
  },

  applyDefaults(state, config) {
    if (config.trueLabel) {
      state.TrueLabel = config.trueLabel;
    } else {
      state.TrueLabel = 'Yes';
    }

    if (config.falseLabel) {
      state.FalseLabel = config.falseLabel;
    } else {
      state.FalseLabel = 'No';
    }

    if (config.defaultValue !== undefined) {
      state.DefaultValue = config.defaultValue;
    }
  },

  validate(stateName, stateConfig) {
    const errors = [];

    if (stateConfig.TrueLabel && typeof stateConfig.TrueLabel !== 'string') {
      errors.push(`${stateName}: TrueLabel must be a string`);
    }

    if (stateConfig.FalseLabel && typeof stateConfig.FalseLabel !== 'string') {
      errors.push(`${stateName}: FalseLabel must be a string`);
    }

    if (stateConfig.DefaultValue !== undefined && typeof stateConfig.DefaultValue !== 'boolean') {
      errors.push(`${stateName}: DefaultValue must be a boolean`);
    }

    return errors;
  },

  validateValue(value, config) {
    if (config.Required && value === undefined) {
      return { valid: false, error: 'A selection is required' };
    }

    if (value !== undefined && typeof value !== 'boolean') {
      return { valid: false, error: 'Value must be true or false' };
    }

    return { valid: true };
  }
};
