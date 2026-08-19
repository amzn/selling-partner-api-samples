/**
 * Workflow Executor
 *
 * Executes ASL workflows by processing states in sequence.
 * Handles state transitions, parameter resolution, and error handling.
 */

import {
  handleSPAPITask,
  handleFetchTask,
  handleCallbackTask,
  handlePassState,
  handleWaitState,
  evaluateChoiceState,
  handleInputState,
  processInputResponse,
  TaskError
} from './task-handlers.js';

/**
 * Signal thrown to pause execution at Input state
 * Not a real error - used for control flow
 */
export class InputPauseSignal extends Error {
  constructor(callbackId, inputRequest) {
    super('Input pause signal');
    this.name = 'InputPauseSignal';
    this.callbackId = callbackId;
    this.inputRequest = inputRequest;
    this.stateName = null;
    this.stateData = null;
    this.resultPath = null;
    this.nextState = null;
  }
}
import { ExecutionStore, ExecutionStatus, EventType } from './execution-store.js';
import {
  evaluateJsonPath,
  resolveParameters,
  applyInputPath,
  applyResultPath,
  applyOutputPath
} from '../utils/json-path.js';

/**
 * Workflow Executor class
 * Manages workflow execution lifecycle
 */
export class WorkflowExecutor {
  /**
   * @param {object} options
   * @param {object} options.spApiClient - SP-API client instance
   * @param {object} options.callbackHandler - Callback handler instance
   */
  constructor(options = {}) {
    this.spApiClient = options.spApiClient || null;
    this.callbackHandler = options.callbackHandler || null;
    this.executionStore = options.executionStore || new ExecutionStore(options.executionStoreOptions);

    // Track running executions for abort
    this.runningExecutions = new Map();
  }

  /**
   * Execute a workflow
   *
   * @param {string} workflowId - Workflow ID
   * @param {string} workflowName - Workflow name
   * @param {object} schema - ASL workflow schema
   * @param {object} input - Workflow input
   * @returns {Promise<object>} Execution result
   */
  async execute(workflowId, workflowName, schema, input = {}) {
    // Create execution record
    const execution = this.executionStore.create(workflowId, workflowName, input);
    const executionId = execution.execution_id;

    // Save workflow schema for potential resume
    this.executionStore.saveWorkflowSchema(executionId, schema);

    // Track as running
    this.runningExecutions.set(executionId, { aborted: false });

    try {
      // Mark started
      this.executionStore.markStarted(executionId, schema.StartAt);

      // Execute state machine
      const result = await this.executeStateMachine(executionId, schema, input);

      // Mark succeeded
      this.executionStore.markSucceeded(executionId, result);

      // Clean up running execution
      this.runningExecutions.delete(executionId);

      return {
        execution_id: executionId,
        status: ExecutionStatus.SUCCEEDED,
        output: result
      };
    } catch (signal) {
      // Check for Input pause signal (synchronous pause/resume pattern)
      if (signal instanceof InputPauseSignal) {
        // Save pause state for resume
        this.executionStore.savePauseState(executionId, {
          state_name: signal.stateName,
          state_data: signal.stateData,
          callback_id: signal.callbackId,
          result_path: signal.resultPath,
          next_state: signal.nextState
        });

        // Keep execution tracked but not running
        this.runningExecutions.delete(executionId);

        return {
          execution_id: executionId,
          status: ExecutionStatus.WAITING_FOR_CALLBACK,
          callback_id: signal.callbackId,
          input_request: signal.inputRequest
        };
      }

      // Check if aborted
      const runState = this.runningExecutions.get(executionId);
      if (runState && runState.aborted) {
        this.runningExecutions.delete(executionId);
        return {
          execution_id: executionId,
          status: ExecutionStatus.ABORTED,
          error: 'Execution was aborted'
        };
      }

      // Mark failed
      const errorName = signal.error || signal.name || 'ExecutionError';
      const errorCause = signal.cause || signal.message;
      this.executionStore.markFailed(executionId, errorName, errorCause);

      // Clean up
      this.runningExecutions.delete(executionId);

      return {
        execution_id: executionId,
        status: ExecutionStatus.FAILED,
        error: errorName,
        cause: errorCause
      };
    }
  }

  /**
   * Resume a paused execution after callback is submitted
   *
   * @param {string} executionId - Execution ID
   * @returns {Promise<object>} Execution result
   */
  async resume(executionId) {
    const execution = this.executionStore.get(executionId);
    if (!execution) {
      return {
        success: false,
        error: `Execution not found: ${executionId}`
      };
    }

    if (execution.status !== ExecutionStatus.WAITING_FOR_CALLBACK) {
      return {
        success: false,
        error: `Execution not waiting for input. Status: ${execution.status}`
      };
    }

    const pauseState = execution.pause_state;
    if (!pauseState) {
      return {
        success: false,
        error: 'No pause state found for execution'
      };
    }

    // Get callback response
    const callback = this.callbackHandler.getCallback(pauseState.callback_id);
    if (!callback) {
      return {
        success: false,
        error: `Callback not found: ${pauseState.callback_id}`
      };
    }

    if (callback.status === 'PENDING') {
      return {
        success: false,
        error: 'Callback not yet submitted'
      };
    }

    // Process the callback response
    let userInput;
    try {
      userInput = processInputResponse(callback.response);
    } catch (error) {
      // User cancelled or other error
      this.executionStore.markFailed(executionId, error.error || 'InputError', error.cause || error.message);
      return {
        execution_id: executionId,
        status: ExecutionStatus.FAILED,
        error: error.error || 'InputError',
        cause: error.cause || error.message
      };
    }

    // Apply user input to state data using ResultPath
    const stateData = applyResultPath(
      pauseState.state_data,
      userInput,
      pauseState.result_path
    );

    // Clear pause state and mark as running
    this.executionStore.clearPauseState(executionId);
    this.executionStore.update(executionId, { status: ExecutionStatus.RUNNING });

    this.executionStore.addEvent(executionId, EventType.CALLBACK_RECEIVED, {
      callback_id: pauseState.callback_id
    });

    // Track as running
    this.runningExecutions.set(executionId, { aborted: false });

    // Get workflow schema
    const schema = execution.workflow_schema;
    if (!schema) {
      return {
        success: false,
        error: 'Workflow schema not found for execution'
      };
    }

    // Continue from next state (or null if Input state had End: true)
    const nextState = pauseState.next_state;
    if (!nextState) {
      // Input state was the last state
      this.executionStore.markSucceeded(executionId, stateData);
      this.runningExecutions.delete(executionId);
      return {
        execution_id: executionId,
        status: ExecutionStatus.SUCCEEDED,
        output: stateData
      };
    }

    try {
      // Continue execution from the next state
      const result = await this.executeStateMachine(executionId, schema, stateData, nextState);

      // Mark succeeded
      this.executionStore.markSucceeded(executionId, result);
      this.runningExecutions.delete(executionId);

      return {
        execution_id: executionId,
        status: ExecutionStatus.SUCCEEDED,
        output: result
      };
    } catch (signal) {
      // Check for another Input pause
      if (signal instanceof InputPauseSignal) {
        // Save new pause state
        this.executionStore.savePauseState(executionId, {
          state_name: signal.stateName,
          state_data: signal.stateData,
          callback_id: signal.callbackId,
          result_path: signal.resultPath,
          next_state: signal.nextState
        });

        this.runningExecutions.delete(executionId);

        return {
          execution_id: executionId,
          status: ExecutionStatus.WAITING_FOR_CALLBACK,
          callback_id: signal.callbackId,
          input_request: signal.inputRequest
        };
      }

      // Check if aborted
      const runState = this.runningExecutions.get(executionId);
      if (runState && runState.aborted) {
        this.runningExecutions.delete(executionId);
        return {
          execution_id: executionId,
          status: ExecutionStatus.ABORTED,
          error: 'Execution was aborted'
        };
      }

      // Mark failed
      const errorName = signal.error || signal.name || 'ExecutionError';
      const errorCause = signal.cause || signal.message;
      this.executionStore.markFailed(executionId, errorName, errorCause);
      this.runningExecutions.delete(executionId);

      return {
        execution_id: executionId,
        status: ExecutionStatus.FAILED,
        error: errorName,
        cause: errorCause
      };
    }
  }

  /**
   * Execute the state machine
   *
   * @param {string} executionId - Execution ID
   * @param {object} schema - Workflow schema
   * @param {object} input - Initial input
   * @param {string} startState - Optional state to start from (for resume)
   * @returns {Promise<object>} Final output
   */
  async executeStateMachine(executionId, schema, input, startState = null) {
    let currentState = startState || schema.StartAt;
    let currentData = input;

    while (currentState) {
      // Check for abort
      const runState = this.runningExecutions.get(executionId);
      if (runState && runState.aborted) {
        throw new Error('Execution aborted');
      }

      const state = schema.States[currentState];
      if (!state) {
        throw new TaskError('InvalidState', `State not found: ${currentState}`);
      }

      // Update current state
      this.executionStore.update(executionId, { current_state: currentState });
      this.executionStore.addEvent(executionId, EventType.STATE_ENTERED, {
        state_name: currentState,
        state_type: state.Type
      });

      try {
        // Execute the state
        const { output, nextState } = await this.executeState(
          executionId,
          currentState,
          state,
          currentData
        );

        // Log state exit
        this.executionStore.addEvent(executionId, EventType.STATE_EXITED, {
          state_name: currentState,
          state_type: state.Type,
          next_state: nextState
        });

        // Update for next iteration
        currentData = output;
        currentState = nextState;
      } catch (error) {
        // Log state failure with full error details for debugging
        this.executionStore.addEvent(executionId, EventType.STATE_FAILED, {
          state_name: currentState,
          error: error.error || error.name,
          cause: error.cause || error.message,
          details: error.details || null  // Include SP-API error response details
        });

        // Try to handle with Catch
        const catchResult = await this.handleCatch(state, error, currentData);
        if (catchResult) {
          currentData = catchResult.output;
          currentState = catchResult.nextState;
        } else {
          throw error;
        }
      }
    }

    return currentData;
  }

  /**
   * Execute a single state
   *
   * @param {string} executionId - Execution ID
   * @param {string} stateName - State name
   * @param {object} state - State definition
   * @param {object} input - State input
   * @returns {Promise<object>} { output, nextState }
   */
  async executeState(executionId, stateName, state, input) {
    // Apply InputPath
    let effectiveInput = applyInputPath(input, state.InputPath);

    // Execute based on state type
    let result;
    switch (state.Type) {
      case 'Task':
        result = await this.executeTaskState(executionId, stateName, state, effectiveInput);
        break;

      case 'Pass':
        result = handlePassState(state, effectiveInput);
        break;

      case 'Wait':
        result = await handleWaitState(state, effectiveInput);
        break;

      case 'Choice':
        return this.executeChoiceState(state, effectiveInput);

      case 'Succeed':
        return { output: effectiveInput, nextState: null };

      case 'Fail':
        throw new TaskError(state.Error || 'StateFailed', state.Cause || 'State failed');

      case 'Input':
        // Pass both original input (for ResultPath) and effectiveInput (for state logic)
        await this.executeInputState(executionId, stateName, state, input, effectiveInput);
        // executeInputState always throws InputPauseSignal, never returns
        break;

      case 'Parallel':
        result = await this.executeParallelState(executionId, state, effectiveInput);
        break;

      case 'Map':
        result = await this.executeMapState(executionId, state, effectiveInput);
        break;

      default:
        throw new TaskError('UnknownStateType', `Unknown state type: ${state.Type}`);
    }

    // Apply ResultPath
    const outputWithResult = applyResultPath(input, result, state.ResultPath);

    // Apply OutputPath
    const finalOutput = applyOutputPath(outputWithResult, state.OutputPath);

    // Determine next state
    const nextState = state.End ? null : state.Next;

    return { output: finalOutput, nextState };
  }

  /**
   * Execute a Task state
   *
   * @param {string} executionId - Execution ID
   * @param {string} stateName - State name
   * @param {object} state - State definition
   * @param {object} input - State input
   * @returns {Promise<object>} Task result
   */
  async executeTaskState(executionId, stateName, state, input) {
    // Resolve parameters using JSONPath
    const parameters = state.Parameters
      ? resolveParameters(state.Parameters, input)
      : input;

    // Create effective state with resolved parameters
    const effectiveState = { ...state, Parameters: parameters };

    // Log full request details for debugging
    this.executionStore.addEvent(executionId, EventType.TASK_SCHEDULED, {
      state_name: stateName,
      resource: state.Resource,
      request: parameters  // Include resolved parameters (full API request)
    });

    let result;
    const resource = state.Resource;

    if (resource === 'sp-api') {
      result = await this.executeWithRetry(
        () => handleSPAPITask(effectiveState, input, this.spApiClient),
        state.Retry
      );
    } else if (resource === 'fetch') {
      result = await this.executeWithRetry(
        () => handleFetchTask(effectiveState),
        state.Retry
      );
    } else if (resource === 'callback') {
      result = await handleCallbackTask(
        effectiveState,
        input,
        this.callbackHandler,
        { executionId, stateName }
      );
    } else {
      throw new TaskError('UnknownResource', `Unknown task resource: ${resource}`);
    }

    // Log full response for debugging
    this.executionStore.addEvent(executionId, EventType.TASK_SUCCEEDED, {
      state_name: stateName,
      response: result  // Include full API response
    });

    return result;
  }

  /**
   * Execute an Input state (human-in-the-loop) - NON-BLOCKING
   *
   * Creates a callback and throws InputPauseSignal to pause execution.
   * The workflow will resume when resume() is called after the callback is submitted.
   *
   * @param {string} executionId - Execution ID
   * @param {string} stateName - State name
   * @param {object} state - State definition
   * @param {object} input - State input (original, before InputPath)
   * @param {object} effectiveInput - Input after InputPath applied
   * @returns {Promise<never>} Always throws InputPauseSignal
   */
  async executeInputState(executionId, stateName, state, input, effectiveInput) {
    this.executionStore.addEvent(executionId, EventType.CALLBACK_REQUESTED, {
      state_name: stateName,
      input_type: state.InputType,
      title: state.Title
    });

    // Create callback (non-blocking)
    const { callbackId, inputRequest } = await handleInputState(
      state,
      effectiveInput,
      this.callbackHandler,
      { executionId, stateName }
    );

    // Determine next state
    const nextState = state.End ? null : state.Next;

    // Throw pause signal to stop execution
    const signal = new InputPauseSignal(callbackId, inputRequest);
    signal.stateName = stateName;
    signal.stateData = input;  // Original input for ResultPath application
    signal.resultPath = state.ResultPath;
    signal.nextState = nextState;

    throw signal;
  }

  /**
   * Execute Choice state
   *
   * @param {object} state - Choice state definition
   * @param {object} input - State input
   * @returns {object} { output, nextState }
   */
  executeChoiceState(state, input) {
    const nextState = evaluateChoiceState(state, input);

    if (!nextState) {
      throw new TaskError('States.NoChoiceMatched', 'No choice rule matched and no Default specified');
    }

    return { output: input, nextState };
  }

  /**
   * Execute Parallel state (MVP: sequential execution)
   *
   * @param {string} executionId - Execution ID
   * @param {object} state - Parallel state definition
   * @param {object} input - State input
   * @returns {Promise<Array>} Array of branch results
   */
  async executeParallelState(executionId, state, input) {
    const branches = state.Branches || [];
    const results = [];

    // MVP: Execute branches sequentially
    for (const branch of branches) {
      const branchResult = await this.executeStateMachine(executionId, branch, input);
      results.push(branchResult);
    }

    return results;
  }

  /**
   * Execute Map state
   *
   * @param {string} executionId - Execution ID
   * @param {object} state - Map state definition
   * @param {object} input - State input
   * @returns {Promise<Array>} Array of iteration results
   */
  async executeMapState(executionId, state, input) {
    // Get items to iterate
    let items;
    if (state.ItemsPath) {
      items = evaluateJsonPath(state.ItemsPath, input);
    } else {
      items = Array.isArray(input) ? input : [input];
    }

    if (!Array.isArray(items)) {
      throw new TaskError('InvalidItemsPath', 'ItemsPath must resolve to an array');
    }

    const processor = state.ItemProcessor || state.Iterator;
    if (!processor) {
      throw new TaskError('MissingItemProcessor', 'Map state requires ItemProcessor');
    }

    const results = [];
    for (const item of items) {
      const itemResult = await this.executeStateMachine(executionId, processor, item);
      results.push(itemResult);
    }

    return results;
  }

  /**
   * Execute with retry logic
   *
   * @param {Function} fn - Function to execute
   * @param {Array} retryConfig - Retry configuration
   * @returns {Promise<any>} Function result
   */
  async executeWithRetry(fn, retryConfig) {
    if (!retryConfig || retryConfig.length === 0) {
      return fn();
    }

    let lastError;
    for (const retry of retryConfig) {
      const errorEquals = retry.ErrorEquals || ['States.ALL'];
      const maxAttempts = retry.MaxAttempts ?? 3;
      const intervalSeconds = retry.IntervalSeconds || 1;
      const backoffRate = retry.BackoffRate || 2.0;

      for (let attempt = 0; attempt <= maxAttempts; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;
          const errorName = error.error || error.name || 'Error';

          // Check if error matches retry config
          const matches = errorEquals.includes('States.ALL') ||
                         errorEquals.includes(errorName) ||
                         errorEquals.includes('States.TaskFailed');

          if (!matches || attempt >= maxAttempts) {
            break; // Try next retry config or throw
          }

          // Wait before retry
          const delay = intervalSeconds * Math.pow(backoffRate, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Handle Catch configuration
   *
   * @param {object} state - State with Catch
   * @param {Error} error - Error to handle
   * @param {object} input - Current input
   * @returns {object|null} { output, nextState } or null
   */
  async handleCatch(state, error, input) {
    if (!state.Catch || state.Catch.length === 0) {
      return null;
    }

    const errorName = error.error || error.name || 'Error';

    for (const catcher of state.Catch) {
      const errorEquals = catcher.ErrorEquals || [];
      const matches = errorEquals.includes('States.ALL') ||
                     errorEquals.includes(errorName) ||
                     errorEquals.includes('States.TaskFailed');

      if (matches) {
        const errorOutput = {
          Error: errorName,
          Cause: error.cause || error.message
        };

        const output = applyResultPath(input, errorOutput, catcher.ResultPath);
        return { output, nextState: catcher.Next };
      }
    }

    return null;
  }

  /**
   * Abort a running execution
   *
   * @param {string} executionId - Execution ID
   * @returns {boolean} True if aborted
   */
  abort(executionId) {
    const runState = this.runningExecutions.get(executionId);
    if (runState) {
      runState.aborted = true;
      this.executionStore.markAborted(executionId, 'User requested abort');
      return true;
    }

    // Check if execution exists but already finished
    const execution = this.executionStore.get(executionId);
    if (execution) {
      if (execution.status === ExecutionStatus.RUNNING ||
          execution.status === ExecutionStatus.WAITING_FOR_CALLBACK) {
        this.executionStore.markAborted(executionId, 'User requested abort');
        return true;
      }
    }

    return false;
  }

  /**
   * Get execution status
   *
   * @param {string} executionId - Execution ID
   * @returns {object|null} Execution status
   */
  getStatus(executionId) {
    const execution = this.executionStore.get(executionId);
    if (!execution) {
      return null;
    }

    return {
      execution_id: execution.execution_id,
      workflow_id: execution.workflow_id,
      workflow_name: execution.workflow_name,
      status: execution.status,
      current_state: execution.current_state,
      started_at: execution.started_at,
      ended_at: execution.ended_at,
      input: execution.input,
      output: execution.output,
      error: execution.error
    };
  }

  /**
   * Get execution events
   *
   * @param {string} executionId - Execution ID
   * @returns {Array|null} Events array or null
   */
  getEvents(executionId) {
    const execution = this.executionStore.get(executionId);
    if (!execution) {
      return null;
    }

    return execution.events;
  }

  /**
   * List executions
   *
   * @param {object} filters - Filter options
   * @returns {Array} Executions list
   */
  listExecutions(filters = {}) {
    return this.executionStore.list(filters).map(e => ({
      execution_id: e.execution_id,
      workflow_id: e.workflow_id,
      workflow_name: e.workflow_name,
      status: e.status,
      started_at: e.started_at,
      ended_at: e.ended_at
    }));
  }
}
