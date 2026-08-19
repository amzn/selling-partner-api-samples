/**
 * Builder Module
 *
 * Handles workflow creation and state management.
 * Provides MCP tools for incrementally building ASL workflows.
 */

import { WorkflowStore } from './workflow-store.js';
import { createTaskState, createFetchState, createChoiceState, createSucceedState, createFailState, createWaitState, createPassState } from './state-factory.js';
import { validateWorkflow, validateState } from '../utils/index.js';
import { createInputState, validateInputState, VALID_INPUT_TYPES } from '../schema/index.js';
import { readFileSync } from 'fs';
import { generateNodejsApp } from './nodejs-generator.js';

// Singleton workflow store (initialized without persistence by default)
let workflowStore = new WorkflowStore();

/**
 * Initialize the workflow store with options (e.g. persistence)
 * @param {object} options
 * @param {string} [options.dataDir] - Directory for file persistence
 */
export function initializeWorkflowStore(options = {}) {
  workflowStore = new WorkflowStore(options);
}

/**
 * Create tool definitions for builder module
 * @returns {Array} Array of MCP tool definitions
 */
export function createBuilderTools() {
  return [
    {
      name: 'create_workflow',
      description: 'Create a new workflow definition',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the workflow'
          },
          description: {
            type: 'string',
            description: 'Optional description of the workflow'
          }
        },
        required: ['name']
      }
    },
    {
      name: 'import_workflow',
      description: 'Import a workflow from an ASL schema JSON file. Task states must use direct API paths (method, path, body) NOT operation names.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name for the imported workflow'
          },
          schema_path: {
            type: 'string',
            description: 'File path to JSON file containing the ASL workflow schema'
          },
          description: {
            type: 'string',
            description: 'Optional description of the workflow'
          }
        },
        required: ['name', 'schema_path']
      }
    },
    {
      name: 'add_task_state',
      description: 'Add a Task state to execute an SP-API call. IMPORTANT: Use direct API paths (e.g., /inbound/fba/2024-03-20/inboundPlans) NOT operation names. The workflow must be self-contained with explicit paths for execution.',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          state_name: {
            type: 'string',
            description: 'Name for this state (must be unique within workflow)'
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            description: 'HTTP method (default: GET)'
          },
          path: {
            type: 'string',
            description: 'Direct SP-API path with version (e.g., /orders/v0/orders/{orderId}, /inbound/fba/2024-03-20/inboundPlans). Must be the actual API endpoint path, NOT operation names.'
          },
          path_params: {
            type: 'object',
            description: 'Path parameter values (e.g., { orderId: "123" } or { "orderId.$": "$.input.orderId" })'
          },
          query_params: {
            type: 'object',
            description: 'Query parameters (e.g., { MarketplaceIds: ["ATVPDKIKX0DER"] })'
          },
          body: {
            type: 'object',
            description: 'Request body for POST/PUT requests'
          },
          result_path: {
            type: 'string',
            description: 'JSONPath where to store the result (e.g., $.orderData)'
          },
          retry: {
            type: 'object',
            description: 'Retry configuration',
            properties: {
              max_attempts: { type: 'number' },
              interval_seconds: { type: 'number' },
              backoff_rate: { type: 'number' }
            }
          }
        },
        required: ['workflow_id', 'state_name', 'path']
      }
    },
    {
      name: 'add_fetch_state',
      description: 'Add a Fetch state to download content from URLs (S3 presigned URLs, report documents, Product Type schemas). Use for fetching external resources like SP-API report documents or Product Type Definition JSON schemas.',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          state_name: {
            type: 'string',
            description: 'Name for this state (must be unique within workflow)'
          },
          url: {
            type: 'string',
            description: 'Static URL to fetch (use this OR url_path)'
          },
          url_path: {
            type: 'string',
            description: 'JSONPath to URL in state data (e.g., $.productTypeDefinition.schema.link.resource). Use this OR url.'
          },
          response_type: {
            type: 'string',
            enum: ['json', 'text', 'base64'],
            description: 'How to parse the response: json (default), text, or base64 for binary'
          },
          decompress: {
            type: 'boolean',
            description: 'Decompress gzip/deflate response body (default: false). Auto-applied when the server sets Content-Encoding; set true for servers that return gzip without that header (e.g., some SP-API report document URLs).'
          },
          headers: {
            type: 'object',
            description: 'Custom HTTP headers to include in the request'
          },
          timeout: {
            type: 'number',
            description: 'Request timeout in seconds (default: 30)'
          },
          output_path: {
            type: 'string',
            description: 'Save fetched content to this local file path instead of storing in workflow context. Returns {saved, path, size} metadata. Use for large files like schemas.'
          },
          output_path_expr: {
            type: 'string',
            description: 'JSONPath expression for dynamic output path (e.g., States.Format(\'/tmp/schemas/{}.json\', $.productType))'
          },
          result_path: {
            type: 'string',
            description: 'JSONPath where to store the fetched content or file metadata (e.g., $.schema)'
          },
          retry: {
            type: 'object',
            description: 'Retry configuration',
            properties: {
              max_attempts: { type: 'number' },
              interval_seconds: { type: 'number' },
              backoff_rate: { type: 'number' }
            }
          }
        },
        required: ['workflow_id', 'state_name']
      }
    },
    {
      name: 'add_choice_state',
      description: 'Add a Choice state for conditional branching',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          state_name: {
            type: 'string',
            description: 'Name for this state'
          },
          choices: {
            type: 'array',
            description: 'Array of choice rules',
            items: {
              type: 'object',
              properties: {
                variable: { type: 'string', description: 'JSONPath to the variable to check' },
                comparison: { type: 'string', description: 'Comparison operator (e.g., NumericLessThan, StringEquals)' },
                value: { description: 'Value to compare against' },
                next: { type: 'string', description: 'State to transition to if condition is true' }
              }
            }
          },
          default: {
            type: 'string',
            description: 'Default state if no choices match'
          }
        },
        required: ['workflow_id', 'state_name', 'choices']
      }
    },
    {
      name: 'add_succeed_state',
      description: 'Add a Succeed state to mark successful completion',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          state_name: {
            type: 'string',
            description: 'Name for this state'
          }
        },
        required: ['workflow_id', 'state_name']
      }
    },
    {
      name: 'add_fail_state',
      description: 'Add a Fail state to mark failure',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          state_name: {
            type: 'string',
            description: 'Name for this state'
          },
          error: {
            type: 'string',
            description: 'Error name'
          },
          cause: {
            type: 'string',
            description: 'Error cause description'
          }
        },
        required: ['workflow_id', 'state_name']
      }
    },
    {
      name: 'add_wait_state',
      description: 'Add a Wait state to pause execution',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          state_name: {
            type: 'string',
            description: 'Name for this state'
          },
          seconds: {
            type: 'number',
            description: 'Number of seconds to wait'
          }
        },
        required: ['workflow_id', 'state_name', 'seconds']
      }
    },
    {
      name: 'add_pass_state',
      description: 'Add a Pass state to pass input to output (optionally with transformation)',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          state_name: {
            type: 'string',
            description: 'Name for this state'
          },
          result: {
            description: 'Fixed result to return'
          },
          result_path: {
            type: 'string',
            description: 'JSONPath where to store the result'
          }
        },
        required: ['workflow_id', 'state_name']
      }
    },
    {
      name: 'add_input_state',
      description: 'Add an Input state for human-in-the-loop interaction. Pauses workflow execution to collect user input. Supports: SingleSelect (pick one from list), MultiSelect (pick multiple), Boolean (yes/no), Text (free text), Number (numeric input), Date (date picker), Form (multi-field), Confirm (approval dialog), Table (select from table rows), JSON (structured JSON with schema reference for AI-assisted generation).',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          state_name: {
            type: 'string',
            description: 'Name for this state (must be unique within workflow)'
          },
          input_type: {
            type: 'string',
            enum: ['SingleSelect', 'MultiSelect', 'Boolean', 'Text', 'Number', 'Date', 'Form', 'Confirm', 'Table', 'JSON'],
            description: 'Type of input to collect. Use JSON for structured JSON input with schema reference.'
          },
          title: {
            type: 'string',
            description: 'Title displayed to the user'
          },
          description: {
            type: 'string',
            description: 'Help text or instructions for the user'
          },
          result_path: {
            type: 'string',
            description: 'JSONPath where to store the user input (e.g., $.userSelection)'
          },
          required: {
            type: 'boolean',
            description: 'Whether input is required (default: true)'
          },
          timeout: {
            type: 'number',
            description: 'Timeout in seconds (default: 3600, max: 86400)'
          },
          default_value: {
            description: 'Default value if user does not provide input'
          },
          config: {
            type: 'object',
            description: 'Type-specific configuration. For SingleSelect/MultiSelect: { options_path: "$.data.options", option_label: "name", option_value: "id" }. For Text: { min_length, max_length, pattern }. For Number: { min, max, step }. For Form: { fields: [{name, label, type, required}] }. For Table: { data_path: "$.items", columns: [{field, header}] }.'
          }
        },
        required: ['workflow_id', 'state_name', 'input_type', 'title', 'result_path']
      }
    },
    {
      name: 'connect_states',
      description: 'Connect two states with a transition',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          from_state: {
            type: 'string',
            description: 'Source state name'
          },
          to_state: {
            type: 'string',
            description: 'Target state name'
          }
        },
        required: ['workflow_id', 'from_state', 'to_state']
      }
    },
    {
      name: 'set_start_state',
      description: 'Set the starting state for the workflow',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          state_name: {
            type: 'string',
            description: 'Name of the state to start with'
          }
        },
        required: ['workflow_id', 'state_name']
      }
    },
    {
      name: 'remove_state',
      description: 'Remove a state from the workflow',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          state_name: {
            type: 'string',
            description: 'Name of the state to remove'
          }
        },
        required: ['workflow_id', 'state_name']
      }
    },
    {
      name: 'get_workflow_schema',
      description: 'Get the ASL schema for a workflow',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          }
        },
        required: ['workflow_id']
      }
    },
    {
      name: 'validate_workflow',
      description: 'Validate a workflow schema',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow to validate'
          }
        },
        required: ['workflow_id']
      }
    },
    {
      name: 'list_workflows',
      description: 'List all workflows',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'delete_workflow',
      description: 'Delete a workflow',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow to delete'
          }
        },
        required: ['workflow_id']
      }
    },
    {
      name: 'workflow_to_mermaid',
      description: 'Convert a workflow schema to a Mermaid diagram for visualization',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow to convert'
          },
          direction: {
            type: 'string',
            enum: ['TB', 'TD', 'BT', 'LR', 'RL'],
            description: 'Diagram direction: TB (top-bottom), TD (top-down), BT (bottom-top), LR (left-right), RL (right-left). Default: TD'
          },
          include_state_types: {
            type: 'boolean',
            description: 'Include state type labels in nodes (default: true)'
          },
          max_label_length: {
            type: 'number',
            description: 'Maximum length for node labels before truncating (default: 30)'
          }
        },
        required: ['workflow_id']
      }
    },
    {
      name: 'workflow_to_nodejs',
      description: 'Convert a workflow to a standalone Node.js console application. The generated app includes an embedded SP-API client, JSONPath utilities, workflow executor, and readline-based human interaction for Input states. Run with: node <output_file>',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow to convert'
          },
          output_path: {
            type: 'string',
            description: 'Optional file path to save the generated code (e.g., /path/to/my-workflow.js). If not provided, returns the code as a string.'
          }
        },
        required: ['workflow_id']
      }
    }
  ];
}

/**
 * Handle builder tool calls
 * @param {string} name - Tool name
 * @param {object} args - Tool arguments
 * @returns {object} Tool result
 */
export async function handleBuilderTool(name, args) {
  switch (name) {
    case 'create_workflow':
      return workflowStore.create(args.name, args.description);

    case 'import_workflow': {
      let schema;

      try {
        const fileContent = readFileSync(args.schema_path, 'utf8');
        schema = JSON.parse(fileContent);
      } catch (e) {
        if (e.code === 'ENOENT') {
          return { success: false, error: `File not found: ${args.schema_path}` };
        }
        return { success: false, error: `Failed to read schema file: ${e.message}` };
      }

      return workflowStore.importSchema(args.name, schema, args.description);
    }

    case 'add_task_state': {
      const requestSpec = {
        method: args.method || 'GET',
        path: args.path,
        pathParams: args.path_params,
        queryParams: args.query_params,
        body: args.body
      };
      const state = createTaskState(requestSpec, {
        resultPath: args.result_path,
        retry: args.retry
      });
      return workflowStore.addState(args.workflow_id, args.state_name, state);
    }

    case 'add_fetch_state': {
      if (!args.url && !args.url_path) {
        return { error: 'Either url or url_path is required' };
      }
      const fetchSpec = {
        url: args.url,
        urlPath: args.url_path,
        responseType: args.response_type,
        decompress: args.decompress,
        headers: args.headers,
        timeout: args.timeout,
        outputPath: args.output_path,
        outputPathExpr: args.output_path_expr
      };
      const state = createFetchState(fetchSpec, {
        resultPath: args.result_path,
        retry: args.retry
      });
      return workflowStore.addState(args.workflow_id, args.state_name, state);
    }

    case 'add_choice_state': {
      const state = createChoiceState(args.choices, args.default);
      return workflowStore.addState(args.workflow_id, args.state_name, state);
    }

    case 'add_succeed_state': {
      const state = createSucceedState();
      return workflowStore.addState(args.workflow_id, args.state_name, state);
    }

    case 'add_fail_state': {
      const state = createFailState(args.error, args.cause);
      return workflowStore.addState(args.workflow_id, args.state_name, state);
    }

    case 'add_wait_state': {
      const state = createWaitState(args.seconds);
      return workflowStore.addState(args.workflow_id, args.state_name, state);
    }

    case 'add_pass_state': {
      const state = createPassState(args.result, args.result_path);
      return workflowStore.addState(args.workflow_id, args.state_name, state);
    }

    case 'add_input_state': {
      // Build config from args
      const inputConfig = {
        title: args.title,
        description: args.description,
        resultPath: args.result_path,
        required: args.required,
        timeout: args.timeout,
        default: args.default_value,
        ...mapInputTypeConfig(args.input_type, args.config || {})
      };

      let state;
      try {
        state = createInputState(args.input_type, inputConfig);
      } catch (err) {
        return {
          error: err.message
        };
      }

      // Validate the Input state
      const validation = validateInputState(args.state_name, state);
      if (!validation.valid) {
        return {
          error: 'Invalid Input state configuration',
          details: validation.errors
        };
      }

      return workflowStore.addState(args.workflow_id, args.state_name, state);
    }

    case 'connect_states':
      return workflowStore.connectStates(args.workflow_id, args.from_state, args.to_state);

    case 'set_start_state':
      return workflowStore.setStartState(args.workflow_id, args.state_name);

    case 'remove_state':
      return workflowStore.removeState(args.workflow_id, args.state_name);

    case 'get_workflow_schema':
      return workflowStore.toASL(args.workflow_id);

    case 'validate_workflow': {
      const schema = workflowStore.toASL(args.workflow_id);
      if (schema.error) {
        return schema;
      }
      return validateWorkflow(schema);
    }

    case 'list_workflows':
      return workflowStore.list();

    case 'delete_workflow':
      return workflowStore.delete(args.workflow_id);

    case 'workflow_to_mermaid': {
      const schema = workflowStore.toASL(args.workflow_id);
      if (schema.error) {
        return schema;
      }
      return convertToMermaid(schema, {
        direction: args.direction || 'TD',
        includeStateTypes: args.include_state_types !== false,
        maxLabelLength: args.max_label_length || 30
      });
    }

    case 'workflow_to_nodejs': {
      const workflow = workflowStore.get(args.workflow_id);
      if (!workflow) {
        return { error: `Workflow not found: ${args.workflow_id}` };
      }
      const schema = workflowStore.toASL(args.workflow_id);
      if (schema.error) {
        return schema;
      }

      const code = generateNodejsApp(schema, {
        workflowName: workflow.name
      });

      // If output_path provided, write to file
      if (args.output_path) {
        try {
          const { writeFileSync } = await import('fs');
          writeFileSync(args.output_path, code, 'utf8');
          return {
            success: true,
            workflow_id: args.workflow_id,
            workflow_name: workflow.name,
            output_path: args.output_path,
            message: `Generated Node.js app saved to ${args.output_path}`,
            usage: `Run with: node ${args.output_path}`
          };
        } catch (err) {
          return {
            error: `Failed to write file: ${err.message}`
          };
        }
      }

      // Return code as string
      return {
        success: true,
        workflow_id: args.workflow_id,
        workflow_name: workflow.name,
        code: code,
        usage: 'Save the code to a .js file and run with: node <filename>.js'
      };
    }

    default:
      throw new Error(`Unknown builder tool: ${name}`);
  }
}

// Export workflow store for other modules
export { workflowStore, convertToMermaid };

/**
 * Get the workflow store instance
 * @returns {WorkflowStore} Workflow store instance
 */
export function getWorkflowStore() {
  return workflowStore;
}

/**
 * Map input type config from tool args (snake_case) to schema format (camelCase)
 * @param {string} inputType - The input type
 * @param {object} config - Config from tool args
 * @returns {object} Config for createInputState
 */
function mapInputTypeConfig(inputType, config) {
  const mapped = {};

  switch (inputType) {
    case 'SingleSelect':
    case 'MultiSelect':
      if (config.options_path) mapped.optionsPath = config.options_path;
      if (config.options) mapped.options = config.options;
      if (config.option_label) mapped.optionLabel = config.option_label;
      if (config.option_value) mapped.optionValue = config.option_value;
      if (config.option_description) mapped.optionDescription = config.option_description;
      if (config.searchable !== undefined) mapped.searchable = config.searchable;
      if (inputType === 'MultiSelect') {
        if (config.min_selections !== undefined) mapped.minSelections = config.min_selections;
        if (config.max_selections !== undefined) mapped.maxSelections = config.max_selections;
        if (config.select_all !== undefined) mapped.selectAll = config.select_all;
      }
      break;

    case 'Boolean':
      if (config.true_label) mapped.trueLabel = config.true_label;
      if (config.false_label) mapped.falseLabel = config.false_label;
      if (config.default_value !== undefined) mapped.defaultValue = config.default_value;
      break;

    case 'Text':
      if (config.min_length !== undefined) mapped.minLength = config.min_length;
      if (config.max_length !== undefined) mapped.maxLength = config.max_length;
      if (config.pattern) mapped.pattern = config.pattern;
      if (config.pattern_error) mapped.patternError = config.pattern_error;
      if (config.multiline !== undefined) mapped.multiline = config.multiline;
      if (config.placeholder) mapped.placeholder = config.placeholder;
      if (config.rows !== undefined) mapped.rows = config.rows;
      break;

    case 'Number':
      if (config.min !== undefined) mapped.min = config.min;
      if (config.max !== undefined) mapped.max = config.max;
      if (config.step !== undefined) mapped.step = config.step;
      if (config.decimal_places !== undefined) mapped.decimalPlaces = config.decimal_places;
      if (config.unit) mapped.unit = config.unit;
      if (config.placeholder) mapped.placeholder = config.placeholder;
      break;

    case 'Date':
      if (config.min_date) mapped.minDate = config.min_date;
      if (config.min_date_path) mapped.minDatePath = config.min_date_path;
      if (config.max_date) mapped.maxDate = config.max_date;
      if (config.max_date_path) mapped.maxDatePath = config.max_date_path;
      if (config.include_time !== undefined) mapped.includeTime = config.include_time;
      if (config.format) mapped.format = config.format;
      if (config.timezone) mapped.timezone = config.timezone;
      break;

    case 'Form':
      if (config.fields) {
        mapped.fields = config.fields.map(f => ({
          name: f.name,
          label: f.label,
          type: f.type,
          required: f.required,
          default: f.default,
          placeholder: f.placeholder,
          validation: f.validation,
          options: f.options
        }));
      }
      if (config.layout) mapped.layout = config.layout;
      if (config.columns !== undefined) mapped.columns = config.columns;
      if (config.submit_label) mapped.submitLabel = config.submit_label;
      if (config.cancel_label) mapped.cancelLabel = config.cancel_label;
      if (config.show_cancel !== undefined) mapped.showCancel = config.show_cancel;
      break;

    case 'Confirm':
      if (config.confirm_label) mapped.confirmLabel = config.confirm_label;
      if (config.cancel_label) mapped.cancelLabel = config.cancel_label;
      if (config.details) mapped.details = config.details;
      if (config.details_path) mapped.detailsPath = config.details_path;
      if (config.detail_fields) {
        mapped.detailFields = config.detail_fields.map(f => ({
          key: f.key,
          label: f.label,
          format: f.format
        }));
      }
      if (config.warning_level) mapped.warningLevel = config.warning_level;
      if (config.warning_message) mapped.warningMessage = config.warning_message;
      if (config.require_typed_confirmation !== undefined) {
        mapped.requireTypedConfirmation = config.require_typed_confirmation;
      }
      if (config.confirmation_phrase) mapped.confirmationPhrase = config.confirmation_phrase;
      break;

    case 'Table':
      if (config.data) mapped.data = config.data;
      if (config.data_path) mapped.dataPath = config.data_path;
      if (config.columns) {
        mapped.columns = config.columns.map(c => ({
          field: c.field,
          header: c.header,
          width: c.width,
          format: c.format,
          sortable: c.sortable
        }));
      }
      if (config.selectable !== undefined) mapped.selectable = config.selectable;
      if (config.multi_select !== undefined) mapped.multiSelect = config.multi_select;
      if (config.min_selections !== undefined) mapped.minSelections = config.min_selections;
      if (config.max_selections !== undefined) mapped.maxSelections = config.max_selections;
      if (config.sortable !== undefined) mapped.sortable = config.sortable;
      if (config.default_sort) {
        mapped.defaultSort = {
          field: config.default_sort.field,
          direction: config.default_sort.direction
        };
      }
      if (config.filterable !== undefined) mapped.filterable = config.filterable;
      if (config.page_size !== undefined) mapped.pageSize = config.page_size;
      if (config.empty_message) mapped.emptyMessage = config.empty_message;
      if (config.row_key) mapped.rowKey = config.row_key;
      break;
  }

  return mapped;
}

/**
 * Convert ASL workflow schema to Mermaid diagram
 * @param {object} schema - ASL workflow schema
 * @param {object} options - Conversion options
 * @returns {object} Result with mermaid diagram string
 */
function convertToMermaid(schema, options = {}) {
  const {
    direction = 'TD',
    includeStateTypes = true,
    maxLabelLength = 30
  } = options;

  const states = schema.States || {};
  const startAt = schema.StartAt;
  const lines = [];
  const nodeIds = new Map(); // Map state names to safe node IDs

  // Generate safe node ID from state name
  const getNodeId = (stateName) => {
    if (!nodeIds.has(stateName)) {
      // Create safe ID by replacing non-alphanumeric chars
      const safeId = `state_${nodeIds.size}`;
      nodeIds.set(stateName, safeId);
    }
    return nodeIds.get(stateName);
  };

  // Truncate label if too long
  const truncateLabel = (label) => {
    if (label.length > maxLabelLength) {
      return label.substring(0, maxLabelLength - 3) + '...';
    }
    return label;
  };

  // Escape special characters for Mermaid
  const escapeLabel = (label) => {
    return label.replace(/"/g, "'").replace(/[[\]]/g, '');
  };

  // Get node shape based on state type
  const getNodeShape = (stateName, stateDef) => {
    const nodeId = getNodeId(stateName);
    const type = stateDef.Type;
    let label = escapeLabel(truncateLabel(stateName));

    if (includeStateTypes && type) {
      label = `${label}\\n(${type})`;
    }

    switch (type) {
      case 'Task':
        return `${nodeId}["${label}"]`; // Rectangle
      case 'Choice':
        return `${nodeId}{"${label}"}`; // Diamond
      case 'Pass':
        return `${nodeId}(["${label}"])`; // Stadium
      case 'Wait':
        return `${nodeId}[/"${label}"/]`; // Parallelogram
      case 'Succeed':
        return `${nodeId}(("${label}"))`; // Circle
      case 'Fail':
        return `${nodeId}((("${label}")))`; // Double circle
      case 'Input':
        return `${nodeId}[["${label}"]]`; // Subroutine shape
      case 'Parallel':
        return `${nodeId}[["${label}"]]`; // Subroutine
      case 'Map':
        return `${nodeId}[["${label}"]]`; // Subroutine
      default:
        return `${nodeId}["${label}"]`;
    }
  };

  // Start the diagram
  lines.push(`flowchart ${direction}`);
  lines.push('');

  // Add start node
  lines.push(`  start((Start))`);

  // Define all nodes first
  lines.push('');
  lines.push('  %% State nodes');
  for (const [stateName, stateDef] of Object.entries(states)) {
    lines.push(`  ${getNodeShape(stateName, stateDef)}`);
  }

  // Add transitions
  lines.push('');
  lines.push('  %% Transitions');

  // Start transition
  if (startAt && states[startAt]) {
    lines.push(`  start --> ${getNodeId(startAt)}`);
  }

  // State transitions
  for (const [stateName, stateDef] of Object.entries(states)) {
    const fromId = getNodeId(stateName);

    // Handle Next transition
    if (stateDef.Next) {
      lines.push(`  ${fromId} --> ${getNodeId(stateDef.Next)}`);
    }

    // Handle End state
    if (stateDef.End === true) {
      lines.push(`  ${fromId} --> endNode((End))`);
    }

    // Handle Choice state
    if (stateDef.Type === 'Choice' && stateDef.Choices) {
      stateDef.Choices.forEach((choice, index) => {
        if (choice.Next) {
          // Create a label for the choice condition
          let conditionLabel = '';
          if (choice.Variable) {
            const varName = choice.Variable.split('.').pop();
            if (choice.StringEquals !== undefined) {
              conditionLabel = `${varName} = "${truncateLabel(String(choice.StringEquals))}"`;
            } else if (choice.NumericEquals !== undefined) {
              conditionLabel = `${varName} = ${choice.NumericEquals}`;
            } else if (choice.NumericLessThan !== undefined) {
              conditionLabel = `${varName} < ${choice.NumericLessThan}`;
            } else if (choice.NumericGreaterThan !== undefined) {
              conditionLabel = `${varName} > ${choice.NumericGreaterThan}`;
            } else if (choice.NumericLessThanPath !== undefined) {
              conditionLabel = `${varName} < path`;
            } else if (choice.BooleanEquals !== undefined) {
              conditionLabel = `${varName} = ${choice.BooleanEquals}`;
            } else {
              conditionLabel = `condition ${index + 1}`;
            }
          } else {
            conditionLabel = `condition ${index + 1}`;
          }
          lines.push(`  ${fromId} -->|"${escapeLabel(conditionLabel)}"| ${getNodeId(choice.Next)}`);
        }
      });

      // Default transition
      if (stateDef.Default) {
        lines.push(`  ${fromId} -->|default| ${getNodeId(stateDef.Default)}`);
      }
    }

    // Handle Catch transitions
    if (stateDef.Catch && Array.isArray(stateDef.Catch)) {
      stateDef.Catch.forEach((catcher) => {
        if (catcher.Next) {
          const errorLabel = catcher.ErrorEquals ? catcher.ErrorEquals.join(', ') : 'error';
          lines.push(`  ${fromId} -.->|"${escapeLabel(truncateLabel(errorLabel))}"| ${getNodeId(catcher.Next)}`);
        }
      });
    }
  }

  // Add styling
  lines.push('');
  lines.push('  %% Styling');
  lines.push('  classDef startEnd fill:#4a4,stroke:#333,color:#fff');
  lines.push('  classDef task fill:#46a,stroke:#333,color:#fff');
  lines.push('  classDef choice fill:#a64,stroke:#333,color:#fff');
  lines.push('  classDef input fill:#64a,stroke:#333,color:#fff');
  lines.push('  classDef fail fill:#a44,stroke:#333,color:#fff');
  lines.push('  classDef succeed fill:#4a4,stroke:#333,color:#fff');
  lines.push('');
  lines.push('  class start,endNode startEnd');

  // Apply classes to nodes based on type
  const taskNodes = [];
  const choiceNodes = [];
  const inputNodes = [];
  const failNodes = [];
  const succeedNodes = [];

  for (const [stateName, stateDef] of Object.entries(states)) {
    const nodeId = getNodeId(stateName);
    switch (stateDef.Type) {
      case 'Task':
        taskNodes.push(nodeId);
        break;
      case 'Choice':
        choiceNodes.push(nodeId);
        break;
      case 'Input':
        inputNodes.push(nodeId);
        break;
      case 'Fail':
        failNodes.push(nodeId);
        break;
      case 'Succeed':
        succeedNodes.push(nodeId);
        break;
    }
  }

  if (taskNodes.length > 0) {
    lines.push(`  class ${taskNodes.join(',')} task`);
  }
  if (choiceNodes.length > 0) {
    lines.push(`  class ${choiceNodes.join(',')} choice`);
  }
  if (inputNodes.length > 0) {
    lines.push(`  class ${inputNodes.join(',')} input`);
  }
  if (failNodes.length > 0) {
    lines.push(`  class ${failNodes.join(',')} fail`);
  }
  if (succeedNodes.length > 0) {
    lines.push(`  class ${succeedNodes.join(',')} succeed`);
  }

  const mermaid = lines.join('\n');

  return {
    success: true,
    workflow_id: schema.workflow_id,
    state_count: Object.keys(states).length,
    mermaid: mermaid,
    usage: 'Paste the mermaid code into a Mermaid renderer (https://mermaid.live) or use in Markdown with ```mermaid code fence'
  };
}
