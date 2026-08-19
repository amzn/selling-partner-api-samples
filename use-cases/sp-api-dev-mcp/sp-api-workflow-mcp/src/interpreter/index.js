/**
 * Interpreter Module
 *
 * Handles workflow execution via MCP tools.
 * Provides tools for starting, monitoring, and controlling workflow executions.
 */

import { WorkflowExecutor } from './executor.js';
export { ExecutionStore, ExecutionStatus, EventType } from './execution-store.js';
export { WorkflowExecutor } from './executor.js';
export { TaskError } from './task-handlers.js';

// Singleton executor instance
let executor = null;

/**
 * Initialize the interpreter with dependencies
 *
 * @param {object} options
 * @param {object} options.spApiClient - SP-API client instance
 * @param {object} options.callbackHandler - Callback handler instance
 */
export function initializeInterpreter(options = {}) {
  executor = new WorkflowExecutor(options);
}

/**
 * Get the executor instance
 *
 * @returns {WorkflowExecutor} Executor instance
 */
export function getExecutor() {
  if (!executor) {
    // Create default executor without SP-API client (for testing)
    executor = new WorkflowExecutor();
  }
  return executor;
}

/**
 * Create tool definitions for interpreter module
 * @returns {Array} Array of MCP tool definitions
 */
export function createInterpreterTools() {
  return [
    {
      name: 'execute_workflow',
      description: 'Execute a workflow with given input. Returns execution ID and status.',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow to execute'
          },
          input: {
            type: 'object',
            description: 'Input data for the workflow'
          }
        },
        required: ['workflow_id']
      }
    },
    {
      name: 'get_execution_status',
      description: 'Get the current status of a workflow execution',
      inputSchema: {
        type: 'object',
        properties: {
          execution_id: {
            type: 'string',
            description: 'ID of the execution'
          }
        },
        required: ['execution_id']
      }
    },
    {
      name: 'list_executions',
      description: 'List workflow executions with optional filters',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'Filter by workflow ID'
          },
          status: {
            type: 'string',
            enum: ['PENDING', 'RUNNING', 'WAITING_FOR_CALLBACK', 'SUCCEEDED', 'FAILED', 'ABORTED'],
            description: 'Filter by status'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 20)'
          }
        }
      }
    },
    {
      name: 'abort_execution',
      description: 'Abort a running workflow execution',
      inputSchema: {
        type: 'object',
        properties: {
          execution_id: {
            type: 'string',
            description: 'ID of the execution to abort'
          }
        },
        required: ['execution_id']
      }
    },
    {
      name: 'get_execution_events',
      description: 'Get execution history/events for debugging. Supports pagination and tailing.',
      inputSchema: {
        type: 'object',
        properties: {
          execution_id: {
            type: 'string',
            description: 'ID of the execution'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of events to return (default: all events)'
          },
          offset: {
            type: 'number',
            description: 'Skip first N events (default: 0)'
          },
          tail: {
            type: 'boolean',
            description: 'If true, return the last N events instead of first N (use with limit)'
          },
          after_id: {
            type: 'number',
            description: 'Return only events with ID greater than this value (for polling new events)'
          },
          event_types: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by event types (e.g., ["StateEntered", "TaskSucceeded"])'
          }
        },
        required: ['execution_id']
      }
    },
    {
      name: 'resume_execution',
      description: 'Resume a paused workflow execution after submitting callback input. Call this after submit_callback to continue the workflow.',
      inputSchema: {
        type: 'object',
        properties: {
          execution_id: {
            type: 'string',
            description: 'ID of the paused execution to resume'
          }
        },
        required: ['execution_id']
      }
    },
    {
      name: 'tail_execution_events',
      description: 'Get the most recent execution events (tail -f style). Useful for monitoring workflow progress.',
      inputSchema: {
        type: 'object',
        properties: {
          execution_id: {
            type: 'string',
            description: 'ID of the execution'
          },
          count: {
            type: 'number',
            description: 'Number of recent events to return (default: 10)'
          },
          after_id: {
            type: 'number',
            description: 'Return only events after this ID (for continuous polling)'
          }
        },
        required: ['execution_id']
      }
    }
  ];
}

/**
 * Handle interpreter tool calls
 *
 * @param {string} name - Tool name
 * @param {object} args - Tool arguments
 * @param {object} context - Execution context (includes workflowStore)
 * @returns {Promise<object>} Tool result
 */
export async function handleInterpreterTool(name, args, context = {}) {
  const exec = getExecutor();
  const { workflowStore } = context;

  switch (name) {
    case 'execute_workflow':
      return executeWorkflow(args, exec, workflowStore);

    case 'get_execution_status':
      return getExecutionStatus(args, exec);

    case 'list_executions':
      return listExecutions(args, exec);

    case 'abort_execution':
      return abortExecution(args, exec);

    case 'get_execution_events':
      return getExecutionEvents(args, exec);

    case 'resume_execution':
      return resumeExecution(args, exec);

    case 'tail_execution_events':
      return tailExecutionEvents(args, exec);

    default:
      return {
        success: false,
        error: `Unknown interpreter tool: ${name}`
      };
  }
}

/**
 * Execute a workflow
 */
async function executeWorkflow(args, executor, workflowStore) {
  const { workflow_id, input = {} } = args;

  if (!workflowStore) {
    return {
      success: false,
      error: 'Workflow store not initialized'
    };
  }

  const workflow = workflowStore.get(workflow_id);
  if (!workflow) {
    return {
      success: false,
      error: `Workflow not found: ${workflow_id}`
    };
  }

  // Get the ASL schema
  const schema = workflowStore.toASL(workflow_id);

  // Validate before execution
  const validation = workflowStore.validate(workflow_id);
  if (!validation.valid) {
    return {
      success: false,
      error: 'Workflow validation failed',
      validation_errors: validation.errors
    };
  }

  try {
    const result = await executor.execute(workflow_id, workflow.name, schema, input);
    return {
      success: true,
      ...result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Execution failed'
    };
  }
}

/**
 * Get execution status
 */
function getExecutionStatus(args, executor) {
  const { execution_id } = args;

  const status = executor.getStatus(execution_id);
  if (!status) {
    return {
      success: false,
      error: `Execution not found: ${execution_id}`
    };
  }

  return {
    success: true,
    ...status
  };
}

/**
 * List executions
 */
function listExecutions(args, executor) {
  const filters = {
    workflow_id: args.workflow_id,
    status: args.status,
    limit: args.limit || 20
  };

  const executions = executor.listExecutions(filters);

  return {
    success: true,
    count: executions.length,
    executions
  };
}

/**
 * Abort execution
 */
function abortExecution(args, executor) {
  const { execution_id } = args;

  const aborted = executor.abort(execution_id);
  if (!aborted) {
    const status = executor.getStatus(execution_id);
    if (!status) {
      return {
        success: false,
        error: `Execution not found: ${execution_id}`
      };
    }
    return {
      success: false,
      error: `Execution cannot be aborted (status: ${status.status})`
    };
  }

  return {
    success: true,
    message: `Execution ${execution_id} aborted`
  };
}

/**
 * Get execution events with pagination and filtering
 */
function getExecutionEvents(args, executor) {
  const {
    execution_id,
    limit,
    offset = 0,
    tail = false,
    after_id,
    event_types
  } = args;

  let events = executor.getEvents(execution_id);
  if (!events) {
    return {
      success: false,
      error: `Execution not found: ${execution_id}`
    };
  }

  const total_events = events.length;

  // Filter by event types if specified
  if (event_types && Array.isArray(event_types) && event_types.length > 0) {
    events = events.filter(e => event_types.includes(e.type));
  }

  // Filter by after_id if specified (for polling new events)
  if (after_id !== undefined && after_id !== null) {
    events = events.filter(e => e.id > after_id);
  }

  const filtered_count = events.length;

  // Apply tail logic - get last N events
  if (tail && limit && limit > 0) {
    events = events.slice(-limit);
  } else {
    // Apply offset and limit
    if (offset > 0) {
      events = events.slice(offset);
    }
    if (limit && limit > 0) {
      events = events.slice(0, limit);
    }
  }

  // Get the last event ID for pagination
  const last_event_id = events.length > 0 ? events[events.length - 1].id : null;
  const first_event_id = events.length > 0 ? events[0].id : null;

  return {
    success: true,
    execution_id,
    total_events,
    filtered_count,
    returned_count: events.length,
    first_event_id,
    last_event_id,
    has_more: tail ? (first_event_id > 1) : (offset + events.length < filtered_count),
    events
  };
}

/**
 * Resume a paused execution
 */
async function resumeExecution(args, executor) {
  const { execution_id } = args;

  const result = await executor.resume(execution_id);

  // Add success field based on result
  if (result.error && !result.execution_id) {
    return {
      success: false,
      error: result.error
    };
  }

  return {
    success: true,
    ...result
  };
}

/**
 * Tail execution events (get most recent events)
 */
function tailExecutionEvents(args, executor) {
  const {
    execution_id,
    count = 10,
    after_id
  } = args;

  let events = executor.getEvents(execution_id);
  if (!events) {
    return {
      success: false,
      error: `Execution not found: ${execution_id}`
    };
  }

  const total_events = events.length;

  // Filter by after_id if specified (for polling new events)
  if (after_id !== undefined && after_id !== null) {
    events = events.filter(e => e.id > after_id);
  } else {
    // No after_id - get last N events
    events = events.slice(-count);
  }

  // Get execution status for context
  const status = executor.getStatus(execution_id);

  // Get the last event ID for next poll
  const last_event_id = events.length > 0 ? events[events.length - 1].id : (after_id || 0);

  // Format events for easy reading
  const formatted_events = events.map(e => ({
    id: e.id,
    type: e.type,
    timestamp: e.timestamp,
    state: e.state_name || e.state || null,
    summary: formatEventSummary(e)
  }));

  return {
    success: true,
    execution_id,
    status: status?.status || 'UNKNOWN',
    current_state: status?.current_state || null,
    total_events,
    returned_count: events.length,
    last_event_id,
    has_more_history: events.length > 0 && events[0].id > 1,
    events: formatted_events
  };
}

/**
 * Format a brief summary for an event
 */
function formatEventSummary(event) {
  switch (event.type) {
    case 'ExecutionStarted':
      return `Started at state: ${event.start_state}`;
    case 'ExecutionSucceeded':
      return 'Workflow completed successfully';
    case 'ExecutionFailed':
      return `Failed: ${event.error} - ${event.cause}`;
    case 'ExecutionAborted':
      return `Aborted: ${event.reason}`;
    case 'StateEntered':
      return `Entered state: ${event.state_name}`;
    case 'StateExited':
      return `Exited state: ${event.state_name}`;
    case 'StateFailed':
      return `State failed: ${event.error}`;
    case 'TaskScheduled':
      return `Task scheduled: ${event.resource || 'task'}`;
    case 'TaskSucceeded':
      return `Task completed`;
    case 'TaskFailed':
      return `Task failed: ${event.error}`;
    case 'CallbackRequested':
      return `Waiting for callback: ${event.callback_id}`;
    case 'CallbackReceived':
      return `Callback received: ${event.callback_id}`;
    case 'ChoiceStateEntered':
      return `Evaluating choice: ${event.state_name}`;
    case 'ChoiceStateExited':
      return `Choice made: ${event.matched_rule || 'default'}`;
    default:
      return event.type;
  }
}
