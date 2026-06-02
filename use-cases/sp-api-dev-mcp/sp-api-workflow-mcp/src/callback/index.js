/**
 * Callback Module
 *
 * Handles human interaction (approval workflows).
 * Provides MCP tools for listing and responding to callbacks.
 */

import { CallbackHandler } from './callback-handler.js';
import { validateInputValue } from '../schema/input-types/index.js';
import { getExecutor } from '../interpreter/index.js';
export { CallbackStore, CallbackStatus } from './callback-store.js';
export { CallbackHandler } from './callback-handler.js';
export { notifyConsole, formatCallback, formatCallbackList } from './notifiers/console.js';

// Singleton callback handler
let callbackHandler = null;

/**
 * Initialize the callback handler
 *
 * @param {object} options - Handler options
 * @param {object} [options.storeOptions] - Options for the callback store (e.g. { dataDir })
 */
export function initializeCallbackHandler(options = {}) {
  callbackHandler = new CallbackHandler(options);
}

/**
 * Get the callback handler instance
 *
 * @returns {CallbackHandler} Handler instance
 */
export function getCallbackHandler() {
  if (!callbackHandler) {
    callbackHandler = new CallbackHandler();
  }
  return callbackHandler;
}

/**
 * Create tool definitions for callback module
 * @returns {Array} Array of MCP tool definitions
 */
export function createCallbackTools() {
  return [
    {
      name: 'list_pending_callbacks',
      description: 'List callbacks waiting for human response',
      inputSchema: {
        type: 'object',
        properties: {
          execution_id: {
            type: 'string',
            description: 'Filter by execution ID'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 20)'
          }
        }
      }
    },
    {
      name: 'get_callback_details',
      description: 'Get detailed information about a callback',
      inputSchema: {
        type: 'object',
        properties: {
          callback_id: {
            type: 'string',
            description: 'ID of the callback'
          }
        },
        required: ['callback_id']
      }
    },
    {
      name: 'submit_callback',
      description: 'Submit a response to a pending callback and automatically resume execution. Returns the next callback or final status.',
      inputSchema: {
        type: 'object',
        properties: {
          callback_id: {
            type: 'string',
            description: 'ID of the callback'
          },
          approved: {
            type: 'boolean',
            description: 'Whether to approve (true) or reject (false)'
          },
          comment: {
            type: 'string',
            description: 'Optional comment or reason'
          },
          data: {
            description: 'Input value for the callback (string for SingleSelect, object for Form, etc.)'
          },
          auto_resume: {
            type: 'boolean',
            description: 'Automatically resume execution after callback (default: true)',
            default: true
          }
        },
        required: ['callback_id', 'approved']
      }
    },
    {
      name: 'extend_callback_timeout',
      description: 'Extend the timeout for a pending callback',
      inputSchema: {
        type: 'object',
        properties: {
          callback_id: {
            type: 'string',
            description: 'ID of the callback'
          },
          additional_seconds: {
            type: 'number',
            description: 'Number of seconds to add to the timeout'
          }
        },
        required: ['callback_id', 'additional_seconds']
      }
    }
  ];
}

/**
 * Handle callback tool calls
 *
 * @param {string} name - Tool name
 * @param {object} args - Tool arguments
 * @param {object} context - Execution context
 * @returns {Promise<object>} Tool result
 */
export async function handleCallbackTool(name, args, context = {}) {
  const handler = getCallbackHandler();

  switch (name) {
    case 'list_pending_callbacks':
      return listPendingCallbacks(args, handler);

    case 'get_callback_details':
      return getCallbackDetails(args, handler);

    case 'submit_callback':
      return await submitCallback(args, handler);

    case 'extend_callback_timeout':
      return extendCallbackTimeout(args, handler);

    default:
      return {
        success: false,
        error: `Unknown callback tool: ${name}`
      };
  }
}

/**
 * List pending callbacks
 */
function listPendingCallbacks(args, handler) {
  const callbacks = handler.listPending({
    execution_id: args.execution_id,
    limit: args.limit || 20
  });

  return {
    success: true,
    count: callbacks.length,
    callbacks: callbacks.map(cb => ({
      callback_id: cb.id,
      execution_id: cb.execution_id,
      state_name: cb.state_name,
      prompt: cb.prompt,
      created_at: cb.created_at,
      expires_at: cb.expires_at,
      input_type: cb.input_type
    }))
  };
}

/**
 * Get callback details
 */
function getCallbackDetails(args, handler) {
  const callback = handler.getCallback(args.callback_id);

  if (!callback) {
    return {
      success: false,
      error: `Callback not found: ${args.callback_id}`
    };
  }

  return {
    success: true,
    callback: {
      callback_id: callback.id,
      execution_id: callback.execution_id,
      state_name: callback.state_name,
      prompt: callback.prompt,
      details: callback.details,
      status: callback.status,
      created_at: callback.created_at,
      expires_at: callback.expires_at,
      resolved_at: callback.resolved_at,
      response: callback.response,
      // Input state fields for synchronous execution
      input_type: callback.input_type,
      input_request: callback.input_request
    }
  };
}

/**
 * Submit callback response and optionally auto-resume execution
 */
async function submitCallback(args, handler) {
  // Get callback to check if it's an Input callback
  const callback = handler.getCallback(args.callback_id);
  if (!callback) {
    return {
      success: false,
      error: `Callback not found: ${args.callback_id}`
    };
  }

  // If this is an Input callback and approved, validate the data
  if (callback.input_type && args.approved && args.data !== undefined) {
    const validation = validateInputValue(
      callback.input_type,
      args.data,
      callback.input_request
    );
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid input: ${validation.error}`
      };
    }
  }

  const result = handler.submitCallback(
    args.callback_id,
    args.approved,
    args.comment || '',
    args.data
  );

  if (!result.success) {
    return result;
  }

  // Auto-resume execution (default: true)
  const autoResume = args.auto_resume !== false;
  if (autoResume && callback.execution_id) {
    try {
      const executor = getExecutor();
      const resumeResult = await executor.resume(callback.execution_id);

      return {
        success: true,
        message: `Callback ${args.callback_id} ${args.approved ? 'approved' : 'rejected'}`,
        callback_id: result.callback_id,
        callback_status: result.status,
        // Include resume result
        execution_id: callback.execution_id,
        ...resumeResult
      };
    } catch (error) {
      // Return callback success but note resume failure
      return {
        success: true,
        message: `Callback ${args.callback_id} ${args.approved ? 'approved' : 'rejected'}`,
        callback_id: result.callback_id,
        callback_status: result.status,
        resume_error: error.message
      };
    }
  }

  return {
    success: true,
    message: `Callback ${args.callback_id} ${args.approved ? 'approved' : 'rejected'}`,
    callback_id: result.callback_id,
    status: result.status
  };
}

/**
 * Extend callback timeout
 */
function extendCallbackTimeout(args, handler) {
  const result = handler.extendTimeout(args.callback_id, args.additional_seconds);

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    message: `Timeout extended by ${args.additional_seconds} seconds`,
    callback_id: result.callback_id,
    new_expires_at: result.new_expires_at
  };
}
