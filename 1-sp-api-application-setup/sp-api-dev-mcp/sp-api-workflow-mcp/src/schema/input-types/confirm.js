/**
 * Confirm Input Type Schema
 *
 * Confirmation dialog for approval workflows.
 * Shows details and requires explicit confirmation.
 */

export const ConfirmSchema = {
  name: 'Confirm',
  description: 'Confirmation dialog with details display',

  fields: {
    ConfirmLabel: {
      type: 'string',
      default: 'Confirm',
      description: 'Label for the confirm button'
    },
    CancelLabel: {
      type: 'string',
      default: 'Cancel',
      description: 'Label for the cancel button'
    },
    Details: {
      type: 'object',
      required: false,
      description: 'Static key-value pairs to display'
    },
    'Details.$': {
      type: 'string',
      required: false,
      description: 'JSONPath to dynamically load details object'
    },
    DetailFields: {
      type: 'array',
      required: false,
      description: 'Array of field definitions for displaying details',
      items: {
        Key: { type: 'string', description: 'Field key in details object' },
        Label: { type: 'string', description: 'Display label' },
        Format: { type: 'string', enum: ['text', 'currency', 'number', 'date', 'list'], description: 'Display format' }
      }
    },
    WarningLevel: {
      type: 'string',
      enum: ['info', 'warning', 'danger'],
      default: 'info',
      description: 'Visual warning level for the confirmation'
    },
    WarningMessage: {
      type: 'string',
      required: false,
      description: 'Warning message to display prominently'
    },
    RequireTypedConfirmation: {
      type: 'boolean',
      default: false,
      description: 'Require user to type a confirmation phrase'
    },
    ConfirmationPhrase: {
      type: 'string',
      required: false,
      description: 'Phrase user must type to confirm (when RequireTypedConfirmation is true)'
    }
  },

  example: {
    Type: 'Input',
    InputType: 'Confirm',
    Title: 'Confirm Shipment Creation',
    Description: 'Please review and confirm the shipment details',
    'Details.$': '$.shipmentSummary',
    DetailFields: [
      { Key: 'shipmentName', Label: 'Shipment Name', Format: 'text' },
      { Key: 'totalUnits', Label: 'Total Units', Format: 'number' },
      { Key: 'estimatedCost', Label: 'Estimated Cost', Format: 'currency' },
      { Key: 'skuList', Label: 'SKUs', Format: 'list' }
    ],
    WarningLevel: 'warning',
    WarningMessage: 'This action will create a shipment and cannot be undone.',
    ConfirmLabel: 'Create Shipment',
    CancelLabel: 'Go Back',
    Required: true,
    ResultPath: '$.userConfirmation',
    Next: 'CheckConfirmationResult'
  },

  applyDefaults(state, config) {
    state.ConfirmLabel = config.confirmLabel ?? 'Confirm';
    state.CancelLabel = config.cancelLabel ?? 'Cancel';

    if (config.detailsPath) {
      state['Details.$'] = config.detailsPath;
    } else if (config.details) {
      state.Details = config.details;
    }

    if (config.detailFields) {
      state.DetailFields = config.detailFields.map(f => ({
        Key: f.key,
        Label: f.label,
        Format: f.format || 'text'
      }));
    }

    state.WarningLevel = config.warningLevel ?? 'info';

    if (config.warningMessage) {
      state.WarningMessage = config.warningMessage;
    }

    state.RequireTypedConfirmation = config.requireTypedConfirmation ?? false;

    if (config.confirmationPhrase) {
      state.ConfirmationPhrase = config.confirmationPhrase;
    }
  },

  validate(stateName, stateConfig) {
    const errors = [];

    // Validate warning level
    const validWarningLevels = ['info', 'warning', 'danger'];
    if (stateConfig.WarningLevel && !validWarningLevels.includes(stateConfig.WarningLevel)) {
      errors.push(`${stateName}: Invalid WarningLevel '${stateConfig.WarningLevel}'`);
    }

    // Cannot have both static and dynamic details
    if (stateConfig.Details && stateConfig['Details.$']) {
      errors.push(`${stateName}: Cannot have both Details and Details.$`);
    }

    // Validate JSONPath
    if (stateConfig['Details.$'] && !stateConfig['Details.$'].startsWith('$.')) {
      errors.push(`${stateName}: Details.$ must be a valid JSONPath`);
    }

    // Validate DetailFields
    if (stateConfig.DetailFields) {
      if (!Array.isArray(stateConfig.DetailFields)) {
        errors.push(`${stateName}: DetailFields must be an array`);
      } else {
        stateConfig.DetailFields.forEach((field, index) => {
          if (!field.Key) {
            errors.push(`${stateName}.DetailFields[${index}]: Key is required`);
          }
          if (!field.Label) {
            errors.push(`${stateName}.DetailFields[${index}]: Label is required`);
          }
          const validFormats = ['text', 'currency', 'number', 'date', 'list'];
          if (field.Format && !validFormats.includes(field.Format)) {
            errors.push(`${stateName}.DetailFields[${index}]: Invalid Format '${field.Format}'`);
          }
        });
      }
    }

    // If RequireTypedConfirmation is true, ConfirmationPhrase is required
    if (stateConfig.RequireTypedConfirmation && !stateConfig.ConfirmationPhrase) {
      errors.push(`${stateName}: ConfirmationPhrase is required when RequireTypedConfirmation is true`);
    }

    return errors;
  },

  validateValue(value, config) {
    // Value should be an object with { confirmed: boolean, typedPhrase?: string }
    if (config.Required && value === undefined) {
      return { valid: false, error: 'Confirmation response is required' };
    }

    if (value === undefined) {
      return { valid: true };
    }

    if (typeof value !== 'object') {
      // Simple boolean confirmation
      if (typeof value === 'boolean') {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid confirmation response' };
    }

    // Check typed confirmation if required
    if (config.RequireTypedConfirmation && value.confirmed === true) {
      if (!value.typedPhrase) {
        return { valid: false, error: 'Typed confirmation is required' };
      }
      if (value.typedPhrase !== config.ConfirmationPhrase) {
        return { valid: false, error: 'Confirmation phrase does not match' };
      }
    }

    return { valid: true };
  }
};
