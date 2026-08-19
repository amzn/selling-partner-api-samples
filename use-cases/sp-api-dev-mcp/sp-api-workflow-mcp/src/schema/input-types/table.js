/**
 * Table Input Type Schema
 *
 * Tabular data display with optional row selection.
 * Supports sorting, filtering, and single/multi-select.
 */

export const TableSchema = {
  name: 'Table',
  description: 'Tabular data display with optional row selection',

  fields: {
    Data: {
      type: 'array',
      required: false,
      description: 'Static array of row data'
    },
    'Data.$': {
      type: 'string',
      required: false,
      description: 'JSONPath to dynamically load table data'
    },
    Columns: {
      type: 'array',
      required: true,
      description: 'Column definitions',
      items: {
        Field: { type: 'string', required: true, description: 'Data field to display' },
        Header: { type: 'string', required: true, description: 'Column header text' },
        Width: { type: 'string', required: false, description: 'Column width (e.g., "100px", "20%")' },
        Format: { type: 'string', enum: ['text', 'currency', 'number', 'date', 'boolean'], description: 'Data format' },
        Sortable: { type: 'boolean', default: true, description: 'Allow sorting by this column' }
      }
    },
    Selectable: {
      type: 'boolean',
      default: true,
      description: 'Allow row selection'
    },
    MultiSelect: {
      type: 'boolean',
      default: false,
      description: 'Allow selecting multiple rows'
    },
    MinSelections: {
      type: 'integer',
      default: 0,
      description: 'Minimum number of rows to select'
    },
    MaxSelections: {
      type: 'integer',
      required: false,
      description: 'Maximum number of rows to select'
    },
    Sortable: {
      type: 'boolean',
      default: true,
      description: 'Enable table sorting'
    },
    DefaultSort: {
      type: 'object',
      required: false,
      description: 'Default sort configuration',
      properties: {
        Field: { type: 'string' },
        Direction: { type: 'string', enum: ['asc', 'desc'] }
      }
    },
    Filterable: {
      type: 'boolean',
      default: false,
      description: 'Enable search/filter functionality'
    },
    PageSize: {
      type: 'integer',
      default: 10,
      description: 'Number of rows per page (0 for no pagination)'
    },
    EmptyMessage: {
      type: 'string',
      default: 'No data available',
      description: 'Message shown when table is empty'
    },
    RowKey: {
      type: 'string',
      required: false,
      description: 'Field to use as unique row identifier'
    },
    ReturnType: {
      type: 'string',
      required: false,
      enum: ['row', 'id'],
      default: 'row',
      description: 'What the callback should submit: "row" for the full selected row object, "id" for just the row identifier field (requires RowKey)'
    }
  },

  example: {
    Type: 'Input',
    InputType: 'Table',
    Title: 'Select SKUs to Replenish',
    Description: 'Choose which low-inventory SKUs to include in the shipment',
    'Data.$': '$.inventoryReport.lowStockItems',
    Columns: [
      { Field: 'sku', Header: 'SKU', Width: '120px', Sortable: true },
      { Field: 'productName', Header: 'Product Name', Sortable: true },
      { Field: 'currentQty', Header: 'Current Qty', Format: 'number', Width: '100px', Sortable: true },
      { Field: 'reorderPoint', Header: 'Reorder Point', Format: 'number', Width: '100px' },
      { Field: 'suggestedQty', Header: 'Suggested Order', Format: 'number', Width: '120px' }
    ],
    Selectable: true,
    MultiSelect: true,
    MinSelections: 1,
    Sortable: true,
    DefaultSort: { Field: 'currentQty', Direction: 'asc' },
    Filterable: true,
    PageSize: 20,
    RowKey: 'sku',
    Required: true,
    ResultPath: '$.selectedSKUsForReplenishment',
    Next: 'ProcessSelectedSKUs'
  },

  applyDefaults(state, config) {
    // Data source
    if (config.dataPath) {
      state['Data.$'] = config.dataPath;
    } else if (config.data) {
      state.Data = config.data;
    }

    // Columns (required)
    if (config.columns && Array.isArray(config.columns)) {
      state.Columns = config.columns.map(col => ({
        Field: col.field,
        Header: col.header,
        ...(col.width && { Width: col.width }),
        ...(col.format && { Format: col.format }),
        Sortable: col.sortable ?? true
      }));
    }

    // Selection options
    state.Selectable = config.selectable ?? true;
    state.MultiSelect = config.multiSelect ?? false;

    if (config.minSelections !== undefined) {
      state.MinSelections = config.minSelections;
    }

    if (config.maxSelections !== undefined) {
      state.MaxSelections = config.maxSelections;
    }

    // Sorting
    state.Sortable = config.sortable ?? true;
    if (config.defaultSort) {
      state.DefaultSort = {
        Field: config.defaultSort.field,
        Direction: config.defaultSort.direction || 'asc'
      };
    }

    // Filtering
    state.Filterable = config.filterable ?? false;

    // Pagination
    state.PageSize = config.pageSize ?? 10;

    // Other options
    if (config.emptyMessage) {
      state.EmptyMessage = config.emptyMessage;
    }

    if (config.rowKey) {
      state.RowKey = config.rowKey;
    }
  },

  validate(stateName, stateConfig) {
    const errors = [];

    // Must have either Data or Data.$
    const hasStaticData = stateConfig.Data !== undefined;
    const hasDynamicData = stateConfig['Data.$'] !== undefined;

    if (!hasStaticData && !hasDynamicData) {
      errors.push(`${stateName}: Table requires either Data or Data.$ field`);
    }

    if (hasStaticData && hasDynamicData) {
      errors.push(`${stateName}: Cannot have both Data and Data.$`);
    }

    // Validate Data.$
    if (hasDynamicData && !stateConfig['Data.$'].startsWith('$.')) {
      errors.push(`${stateName}: Data.$ must be a valid JSONPath`);
    }

    // Columns is required
    if (!stateConfig.Columns) {
      errors.push(`${stateName}: Columns is required for Table input`);
    } else if (!Array.isArray(stateConfig.Columns)) {
      errors.push(`${stateName}: Columns must be an array`);
    } else if (stateConfig.Columns.length === 0) {
      errors.push(`${stateName}: Columns array cannot be empty`);
    } else {
      // Validate each column
      stateConfig.Columns.forEach((col, index) => {
        const colPrefix = `${stateName}.Columns[${index}]`;
        if (!col.Field) {
          errors.push(`${colPrefix}: Field is required`);
        }
        if (!col.Header) {
          errors.push(`${colPrefix}: Header is required`);
        }
        const validFormats = ['text', 'currency', 'number', 'date', 'boolean'];
        if (col.Format && !validFormats.includes(col.Format)) {
          errors.push(`${colPrefix}: Invalid Format '${col.Format}'`);
        }
      });
    }

    // Validate selection constraints
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

    // Validate DefaultSort
    if (stateConfig.DefaultSort) {
      if (!stateConfig.DefaultSort.Field) {
        errors.push(`${stateName}: DefaultSort.Field is required`);
      }
      const validDirections = ['asc', 'desc'];
      if (stateConfig.DefaultSort.Direction &&
          !validDirections.includes(stateConfig.DefaultSort.Direction)) {
        errors.push(`${stateName}: DefaultSort.Direction must be 'asc' or 'desc'`);
      }
    }

    // PageSize validation
    if (stateConfig.PageSize !== undefined && stateConfig.PageSize < 0) {
      errors.push(`${stateName}: PageSize cannot be negative`);
    }

    return errors;
  },

  validateValue(value, config) {
    const selectable = config.Selectable ?? true;
    const multiSelect = config.MultiSelect ?? false;
    const minSelections = config.MinSelections ?? 0;
    const maxSelections = config.MaxSelections;

    // If not selectable, no selection validation needed
    if (!selectable) {
      return { valid: true };
    }

    // Handle required check
    if (config.Required && minSelections > 0) {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        return { valid: false, error: `At least ${minSelections} row(s) must be selected` };
      }
    }

    if (!value) {
      if (minSelections > 0) {
        return { valid: false, error: `At least ${minSelections} row(s) must be selected` };
      }
      return { valid: true };
    }

    // Normalize to array
    const selections = Array.isArray(value) ? value : [value];

    // Single select validation
    if (!multiSelect && selections.length > 1) {
      return { valid: false, error: 'Only one row can be selected' };
    }

    // Min selections
    if (selections.length < minSelections) {
      return { valid: false, error: `At least ${minSelections} row(s) must be selected` };
    }

    // Max selections
    if (maxSelections !== undefined && selections.length > maxSelections) {
      return { valid: false, error: `Maximum ${maxSelections} row(s) can be selected` };
    }

    return { valid: true };
  }
};
