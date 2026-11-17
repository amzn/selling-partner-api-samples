/**
 * Form Input Type Schema
 *
 * Multi-field form for collecting structured data.
 * Supports various field types within a single form.
 */

export const FormSchema = {
  name: 'Form',
  description: 'Multi-field form for collecting structured data',

  fields: {
    Fields: {
      type: 'array',
      required: true,
      description: 'Array of field definitions',
      items: {
        Name: { type: 'string', required: true, description: 'Field identifier' },
        Label: { type: 'string', required: true, description: 'Display label' },
        Type: {
          type: 'string',
          enum: ['text', 'number', 'date', 'select', 'boolean', 'email', 'phone', 'textarea'],
          default: 'text',
          description: 'Field type'
        },
        Required: { type: 'boolean', default: true, description: 'Whether field is required' },
        Default: { type: 'any', required: false, description: 'Default value' },
        Placeholder: { type: 'string', required: false, description: 'Placeholder text' },
        Validation: { type: 'object', required: false, description: 'Type-specific validation rules' },
        Options: { type: 'array', required: false, description: 'Options for select fields' }
      }
    },
    Layout: {
      type: 'string',
      enum: ['vertical', 'horizontal', 'grid'],
      default: 'vertical',
      description: 'Form layout style'
    },
    Columns: {
      type: 'integer',
      default: 1,
      description: 'Number of columns for grid layout'
    },
    SubmitLabel: {
      type: 'string',
      default: 'Submit',
      description: 'Label for the submit button'
    },
    CancelLabel: {
      type: 'string',
      default: 'Cancel',
      description: 'Label for the cancel button'
    },
    ShowCancel: {
      type: 'boolean',
      default: true,
      description: 'Whether to show a cancel button'
    }
  },

  example: {
    Type: 'Input',
    InputType: 'Form',
    Title: 'Shipment Details',
    Description: 'Enter the shipment information',
    Fields: [
      {
        Name: 'shipmentName',
        Label: 'Shipment Name',
        Type: 'text',
        Required: true,
        Placeholder: 'Enter shipment name'
      },
      {
        Name: 'quantity',
        Label: 'Quantity',
        Type: 'number',
        Required: true,
        Validation: { min: 1, max: 10000 }
      },
      {
        Name: 'shipDate',
        Label: 'Ship Date',
        Type: 'date',
        Required: true
      },
      {
        Name: 'priority',
        Label: 'Priority',
        Type: 'select',
        Required: true,
        Options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' }
        ],
        Default: 'medium'
      },
      {
        Name: 'notes',
        Label: 'Notes',
        Type: 'textarea',
        Required: false,
        Placeholder: 'Additional notes...'
      }
    ],
    Layout: 'vertical',
    SubmitLabel: 'Create Shipment',
    Required: true,
    ResultPath: '$.shipmentDetails',
    Next: 'ProcessShipment'
  },

  applyDefaults(state, config) {
    if (!config.fields || !Array.isArray(config.fields)) {
      state.Fields = [];
      return;
    }

    state.Fields = config.fields.map(field => ({
      Name: field.name,
      Label: field.label,
      Type: field.type || 'text',
      Required: field.required ?? true,
      ...(field.default !== undefined && { Default: field.default }),
      ...(field.placeholder && { Placeholder: field.placeholder }),
      ...(field.validation && { Validation: field.validation }),
      ...(field.options && { Options: field.options })
    }));

    state.Layout = config.layout ?? 'vertical';

    if (config.columns) {
      state.Columns = config.columns;
    }

    state.SubmitLabel = config.submitLabel ?? 'Submit';
    state.CancelLabel = config.cancelLabel ?? 'Cancel';
    state.ShowCancel = config.showCancel ?? true;
  },

  validate(stateName, stateConfig) {
    const errors = [];

    if (!stateConfig.Fields) {
      errors.push(`${stateName}: Fields is required for Form input`);
      return errors;
    }

    if (!Array.isArray(stateConfig.Fields)) {
      errors.push(`${stateName}: Fields must be an array`);
      return errors;
    }

    if (stateConfig.Fields.length === 0) {
      errors.push(`${stateName}: Fields array cannot be empty`);
    }

    const fieldNames = new Set();
    stateConfig.Fields.forEach((field, index) => {
      const fieldPrefix = `${stateName}.Fields[${index}]`;

      if (!field.Name) {
        errors.push(`${fieldPrefix}: Name is required`);
      } else if (fieldNames.has(field.Name)) {
        errors.push(`${fieldPrefix}: Duplicate field name '${field.Name}'`);
      } else {
        fieldNames.add(field.Name);
      }

      if (!field.Label) {
        errors.push(`${fieldPrefix}: Label is required`);
      }

      const validTypes = ['text', 'number', 'date', 'select', 'boolean', 'email', 'phone', 'textarea'];
      if (field.Type && !validTypes.includes(field.Type)) {
        errors.push(`${fieldPrefix}: Invalid Type '${field.Type}'`);
      }

      if (field.Type === 'select' && (!field.Options || !Array.isArray(field.Options))) {
        errors.push(`${fieldPrefix}: Options array is required for select type`);
      }
    });

    const validLayouts = ['vertical', 'horizontal', 'grid'];
    if (stateConfig.Layout && !validLayouts.includes(stateConfig.Layout)) {
      errors.push(`${stateName}: Invalid Layout '${stateConfig.Layout}'`);
    }

    return errors;
  },

  validateValue(value, config) {
    if (!config.Fields) {
      return { valid: true };
    }

    if (config.Required && (!value || typeof value !== 'object')) {
      return { valid: false, error: 'Form data is required' };
    }

    if (!value) {
      return { valid: true };
    }

    const errors = [];

    for (const field of config.Fields) {
      const fieldValue = value[field.Name];
      const isRequired = field.Required ?? true;

      if (isRequired && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
        errors.push({ field: field.Name, error: `${field.Label} is required` });
        continue;
      }

      if (fieldValue === undefined || fieldValue === null) {
        continue;
      }

      // Type-specific validation
      if (field.Validation) {
        const typeError = validateFieldType(field, fieldValue);
        if (typeError) {
          errors.push({ field: field.Name, error: typeError });
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true };
  }
};

/**
 * Validate a field value based on its type and validation rules
 */
function validateFieldType(field, value) {
  const validation = field.Validation || {};

  switch (field.Type) {
    case 'number':
      if (typeof value !== 'number' && isNaN(parseFloat(value))) {
        return 'Must be a valid number';
      }
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      if (validation.min !== undefined && numValue < validation.min) {
        return `Must be at least ${validation.min}`;
      }
      if (validation.max !== undefined && numValue > validation.max) {
        return `Must be at most ${validation.max}`;
      }
      break;

    case 'text':
    case 'textarea':
      if (typeof value !== 'string') {
        return 'Must be text';
      }
      if (validation.minLength && value.length < validation.minLength) {
        return `Must be at least ${validation.minLength} characters`;
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        return `Must be at most ${validation.maxLength} characters`;
      }
      if (validation.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          return validation.patternError || 'Invalid format';
        }
      }
      break;

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Must be a valid email address';
      }
      break;

    case 'phone':
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(value)) {
        return 'Must be a valid phone number';
      }
      break;

    case 'select':
      if (field.Options) {
        const validValues = field.Options.map(o => o.value || o);
        if (!validValues.includes(value)) {
          return 'Invalid selection';
        }
      }
      break;
  }

  return null;
}
