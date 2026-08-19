/**
 * Date Input Type Schema
 *
 * Date/datetime picker with optional range constraints.
 * Supports date-only or date+time input.
 */

export const DateSchema = {
  name: 'Date',
  description: 'Date or datetime picker with optional range constraints',

  fields: {
    MinDate: {
      type: 'string',
      required: false,
      description: 'Minimum allowed date (ISO format or "today")'
    },
    'MinDate.$': {
      type: 'string',
      required: false,
      description: 'JSONPath to dynamically get minimum date'
    },
    MaxDate: {
      type: 'string',
      required: false,
      description: 'Maximum allowed date (ISO format or "today")'
    },
    'MaxDate.$': {
      type: 'string',
      required: false,
      description: 'JSONPath to dynamically get maximum date'
    },
    IncludeTime: {
      type: 'boolean',
      default: false,
      description: 'Include time selection (datetime vs date only)'
    },
    Format: {
      type: 'string',
      default: 'YYYY-MM-DD',
      description: 'Display format for the date'
    },
    Timezone: {
      type: 'string',
      required: false,
      description: 'Timezone for datetime values (e.g., "America/Los_Angeles")'
    }
  },

  example: {
    Type: 'Input',
    InputType: 'Date',
    Title: 'Select Delivery Window',
    Description: 'Choose your preferred delivery date',
    MinDate: 'today',
    'MaxDate.$': '$.deliveryOptions.latestDate',
    IncludeTime: false,
    Format: 'YYYY-MM-DD',
    Required: true,
    ResultPath: '$.selectedDeliveryDate',
    Next: 'ConfirmDeliveryWindow'
  },

  applyDefaults(state, config) {
    if (config.minDatePath) {
      state['MinDate.$'] = config.minDatePath;
    } else if (config.minDate) {
      state.MinDate = config.minDate;
    }

    if (config.maxDatePath) {
      state['MaxDate.$'] = config.maxDatePath;
    } else if (config.maxDate) {
      state.MaxDate = config.maxDate;
    }

    state.IncludeTime = config.includeTime ?? false;
    state.Format = config.format ?? 'YYYY-MM-DD';

    if (config.timezone) {
      state.Timezone = config.timezone;
    }
  },

  validate(stateName, stateConfig) {
    const errors = [];

    // Validate MinDate
    if (stateConfig.MinDate && stateConfig['MinDate.$']) {
      errors.push(`${stateName}: Cannot have both MinDate and MinDate.$`);
    }

    if (stateConfig.MinDate && stateConfig.MinDate !== 'today') {
      if (!isValidDateFormat(stateConfig.MinDate)) {
        errors.push(`${stateName}: MinDate must be a valid ISO date or "today"`);
      }
    }

    // Validate MaxDate
    if (stateConfig.MaxDate && stateConfig['MaxDate.$']) {
      errors.push(`${stateName}: Cannot have both MaxDate and MaxDate.$`);
    }

    if (stateConfig.MaxDate && stateConfig.MaxDate !== 'today') {
      if (!isValidDateFormat(stateConfig.MaxDate)) {
        errors.push(`${stateName}: MaxDate must be a valid ISO date or "today"`);
      }
    }

    // Validate JSONPath references
    if (stateConfig['MinDate.$'] && !stateConfig['MinDate.$'].startsWith('$.')) {
      errors.push(`${stateName}: MinDate.$ must be a valid JSONPath`);
    }

    if (stateConfig['MaxDate.$'] && !stateConfig['MaxDate.$'].startsWith('$.')) {
      errors.push(`${stateName}: MaxDate.$ must be a valid JSONPath`);
    }

    return errors;
  },

  validateValue(value, config, resolvedConstraints = {}) {
    if (config.Required && !value) {
      return { valid: false, error: 'A date is required' };
    }

    if (!value) {
      return { valid: true };
    }

    // Parse the input value
    const dateValue = new Date(value);
    if (isNaN(dateValue.getTime())) {
      return { valid: false, error: 'Invalid date format' };
    }

    // Get min/max dates
    const minDate = resolvedConstraints.minDate || config.MinDate;
    const maxDate = resolvedConstraints.maxDate || config.MaxDate;

    if (minDate) {
      const min = minDate === 'today' ? getToday() : new Date(minDate);
      if (dateValue < min) {
        return { valid: false, error: `Date cannot be before ${formatDate(min)}` };
      }
    }

    if (maxDate) {
      const max = maxDate === 'today' ? getToday() : new Date(maxDate);
      if (dateValue > max) {
        return { valid: false, error: `Date cannot be after ${formatDate(max)}` };
      }
    }

    return { valid: true };
  }
};

/**
 * Check if a string is a valid ISO date format
 */
function isValidDateFormat(str) {
  const date = new Date(str);
  return !isNaN(date.getTime());
}

/**
 * Get today's date at midnight
 */
function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Format date for display
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}
