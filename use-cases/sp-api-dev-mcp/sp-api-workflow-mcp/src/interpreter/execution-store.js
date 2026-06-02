/**
 * Execution Store
 *
 * Tracks workflow execution state and history.
 * In-memory storage for MVP.
 */

import { generateExecutionId } from '../utils/uuid.js';
import { FileStore } from '../utils/file-store.js';

/**
 * Execution status constants
 */
export const ExecutionStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  WAITING_FOR_CALLBACK: 'WAITING_FOR_CALLBACK',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  ABORTED: 'ABORTED'
};

/**
 * Event types for execution history
 */
export const EventType = {
  EXECUTION_STARTED: 'ExecutionStarted',
  EXECUTION_SUCCEEDED: 'ExecutionSucceeded',
  EXECUTION_FAILED: 'ExecutionFailed',
  EXECUTION_ABORTED: 'ExecutionAborted',
  STATE_ENTERED: 'StateEntered',
  STATE_EXITED: 'StateExited',
  STATE_FAILED: 'StateFailed',
  TASK_SCHEDULED: 'TaskScheduled',
  TASK_SUCCEEDED: 'TaskSucceeded',
  TASK_FAILED: 'TaskFailed',
  CALLBACK_REQUESTED: 'CallbackRequested',
  CALLBACK_RECEIVED: 'CallbackReceived',
  CHOICE_STATE_ENTERED: 'ChoiceStateEntered',
  CHOICE_STATE_EXITED: 'ChoiceStateExited'
};

/**
 * Execution Store class
 * Manages workflow execution records
 */
export class ExecutionStore {
  /**
   * @param {object} [options]
   * @param {string} [options.dataDir] - Directory for file persistence. If omitted, in-memory only.
   */
  constructor(options = {}) {
    this.executions = new Map();
    this.fileStore = options.dataDir ? new FileStore(options.dataDir) : null;

    if (this.fileStore) {
      for (const [id, data] of this.fileStore.loadAll()) {
        this.executions.set(id, data);
      }
    }
  }

  _persist(id) {
    if (!this.fileStore) return;
    const exec = this.executions.get(id);
    if (exec) this.fileStore.save(id, exec);
  }

  _unpersist(id) {
    if (this.fileStore) this.fileStore.remove(id);
  }

  /**
   * Create a new execution record
   *
   * @param {string} workflowId - The workflow ID
   * @param {string} workflowName - The workflow name
   * @param {object} input - Input data for the workflow
   * @returns {object} Created execution record
   */
  create(workflowId, workflowName, input) {
    const executionId = generateExecutionId();
    const now = new Date().toISOString();

    const execution = {
      execution_id: executionId,
      workflow_id: workflowId,
      workflow_name: workflowName,
      status: ExecutionStatus.PENDING,
      input: input,
      output: null,
      error: null,
      current_state: null,
      state_data: {},
      events: [],
      started_at: now,
      ended_at: null,
      updated_at: now,
      // Pause state for synchronous execution with resume
      pause_state: null,
      workflow_schema: null
    };

    this.executions.set(executionId, execution);
    this._persist(executionId);
    return execution;
  }

  /**
   * Get an execution by ID
   *
   * @param {string} executionId - Execution ID
   * @returns {object|null} Execution record or null
   */
  get(executionId) {
    return this.executions.get(executionId) || null;
  }

  /**
   * Update an execution
   *
   * @param {string} executionId - Execution ID
   * @param {object} updates - Fields to update
   * @returns {object} Updated execution
   */
  update(executionId, updates) {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    Object.assign(execution, updates, {
      updated_at: new Date().toISOString()
    });

    this._persist(executionId);
    return execution;
  }

  /**
   * Add an event to execution history
   *
   * @param {string} executionId - Execution ID
   * @param {string} type - Event type
   * @param {object} details - Event details
   * @returns {object} Created event
   */
  addEvent(executionId, type, details = {}) {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const event = {
      id: execution.events.length + 1,
      type: type,
      timestamp: new Date().toISOString(),
      ...details
    };

    execution.events.push(event);
    execution.updated_at = event.timestamp;

    this._persist(executionId);
    return event;
  }

  /**
   * List executions with optional filters
   *
   * @param {object} filters - Filter options
   * @param {string} filters.workflow_id - Filter by workflow ID
   * @param {string} filters.status - Filter by status
   * @param {number} filters.limit - Maximum results
   * @returns {Array} Array of executions
   */
  list(filters = {}) {
    let results = Array.from(this.executions.values());

    // Filter by workflow ID
    if (filters.workflow_id) {
      results = results.filter(e => e.workflow_id === filters.workflow_id);
    }

    // Filter by status
    if (filters.status) {
      results = results.filter(e => e.status === filters.status);
    }

    // Sort by started_at descending
    results.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

    // Apply limit
    if (filters.limit && filters.limit > 0) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Mark execution as started
   *
   * @param {string} executionId - Execution ID
   * @param {string} startState - Initial state name
   */
  markStarted(executionId, startState) {
    this.update(executionId, {
      status: ExecutionStatus.RUNNING,
      current_state: startState
    });

    this.addEvent(executionId, EventType.EXECUTION_STARTED, {
      start_state: startState
    });
  }

  /**
   * Mark execution as succeeded
   *
   * @param {string} executionId - Execution ID
   * @param {object} output - Execution output
   */
  markSucceeded(executionId, output) {
    this.update(executionId, {
      status: ExecutionStatus.SUCCEEDED,
      output: output,
      ended_at: new Date().toISOString()
    });

    this.addEvent(executionId, EventType.EXECUTION_SUCCEEDED, {
      output: output
    });
  }

  /**
   * Mark execution as failed
   *
   * @param {string} executionId - Execution ID
   * @param {string} error - Error name
   * @param {string} cause - Error cause
   */
  markFailed(executionId, error, cause) {
    this.update(executionId, {
      status: ExecutionStatus.FAILED,
      error: { error, cause },
      ended_at: new Date().toISOString()
    });

    this.addEvent(executionId, EventType.EXECUTION_FAILED, {
      error: error,
      cause: cause
    });
  }

  /**
   * Mark execution as aborted
   *
   * @param {string} executionId - Execution ID
   * @param {string} reason - Abort reason
   */
  markAborted(executionId, reason) {
    this.update(executionId, {
      status: ExecutionStatus.ABORTED,
      error: { error: 'ExecutionAborted', cause: reason },
      ended_at: new Date().toISOString()
    });

    this.addEvent(executionId, EventType.EXECUTION_ABORTED, {
      reason: reason
    });
  }

  /**
   * Mark execution as waiting for callback
   *
   * @param {string} executionId - Execution ID
   * @param {string} callbackId - Callback ID
   */
  markWaitingForCallback(executionId, callbackId) {
    this.update(executionId, {
      status: ExecutionStatus.WAITING_FOR_CALLBACK
    });

    this.addEvent(executionId, EventType.CALLBACK_REQUESTED, {
      callback_id: callbackId
    });
  }

  /**
   * Resume execution from callback
   *
   * @param {string} executionId - Execution ID
   * @param {string} callbackId - Callback ID
   * @param {object} response - Callback response
   */
  resumeFromCallback(executionId, callbackId, response) {
    this.update(executionId, {
      status: ExecutionStatus.RUNNING
    });

    this.addEvent(executionId, EventType.CALLBACK_RECEIVED, {
      callback_id: callbackId,
      response: response
    });
  }

  /**
   * Save pause state for later resume
   *
   * @param {string} executionId - Execution ID
   * @param {object} pauseState - Pause state data
   * @param {string} pauseState.state_name - State where paused
   * @param {object} pauseState.state_data - Data at pause point
   * @param {string} pauseState.callback_id - Pending callback ID
   * @param {string} pauseState.result_path - Where to store result
   * @param {string} pauseState.next_state - Next state after resume
   */
  savePauseState(executionId, pauseState) {
    this.update(executionId, {
      pause_state: pauseState,
      status: ExecutionStatus.WAITING_FOR_CALLBACK
    });
  }

  /**
   * Clear pause state after resume
   *
   * @param {string} executionId - Execution ID
   */
  clearPauseState(executionId) {
    this.update(executionId, {
      pause_state: null
    });
  }

  /**
   * Get pause state
   *
   * @param {string} executionId - Execution ID
   * @returns {object|null} Pause state or null
   */
  getPauseState(executionId) {
    const execution = this.executions.get(executionId);
    return execution ? execution.pause_state : null;
  }

  /**
   * Save workflow schema for resume
   *
   * @param {string} executionId - Execution ID
   * @param {object} schema - Workflow schema
   */
  saveWorkflowSchema(executionId, schema) {
    this.update(executionId, {
      workflow_schema: schema
    });
  }

  /**
   * Delete an execution
   *
   * @param {string} executionId - Execution ID
   * @returns {boolean} True if deleted
   */
  delete(executionId) {
    this._unpersist(executionId);
    return this.executions.delete(executionId);
  }

  /**
   * Clear all executions (for testing)
   */
  clear() {
    this.executions.clear();
    if (this.fileStore) this.fileStore.clear();
  }
}
