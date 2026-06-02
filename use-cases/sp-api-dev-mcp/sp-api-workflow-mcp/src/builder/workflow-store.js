/**
 * Workflow Store
 *
 * Storage for workflow definitions with optional file-based persistence.
 * Manages workflow lifecycle and state operations.
 */

import { generateWorkflowId, validateWorkflow } from '../utils/index.js';
import { FileStore } from '../utils/file-store.js';

/**
 * Workflow Store class
 * Stores and manages workflow definitions
 */
export class WorkflowStore {
  /**
   * @param {object} [options]
   * @param {string} [options.dataDir] - Directory for file persistence. If omitted, in-memory only.
   */
  constructor(options = {}) {
    /** @type {Map<string, object>} */
    this.workflows = new Map();
    this.fileStore = options.dataDir ? new FileStore(options.dataDir) : null;

    // Load persisted data on startup
    if (this.fileStore) {
      for (const [id, data] of this.fileStore.loadAll()) {
        // Restore states Map from plain object
        data.states = new Map(Object.entries(data.states || {}));
        this.workflows.set(id, data);
      }
    }
  }

  /** Persist a workflow to disk */
  _persist(id) {
    if (!this.fileStore) return;
    const wf = this.workflows.get(id);
    if (!wf) return;
    // Serialize states Map to plain object
    const serializable = { ...wf, states: Object.fromEntries(wf.states) };
    this.fileStore.save(id, serializable);
  }

  /** Remove a workflow from disk */
  _unpersist(id) {
    if (this.fileStore) this.fileStore.remove(id);
  }

  /**
   * Create a new workflow
   * @param {string} name - Workflow name
   * @param {string} description - Optional description
   * @returns {object} Created workflow info
   */
  create(name, description = '') {
    const id = generateWorkflowId();
    const now = new Date().toISOString();

    const workflow = {
      id,
      name,
      description,
      created_at: now,
      updated_at: now,
      start_at: null,
      states: new Map()
    };

    this.workflows.set(id, workflow);
    this._persist(id);

    return {
      workflow_id: id,
      name,
      created_at: now
    };
  }

  /**
   * Get a workflow by ID
   * @param {string} workflowId - Workflow ID
   * @returns {object|null} Workflow or null
   */
  get(workflowId) {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * Add a state to a workflow
   * @param {string} workflowId - Workflow ID
   * @param {string} stateName - State name
   * @param {object} state - State definition
   * @returns {object} Result
   */
  addState(workflowId, stateName, state) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow not found: ${workflowId}` };
    }

    if (workflow.states.has(stateName)) {
      return { success: false, error: `State already exists: ${stateName}` };
    }

    if (stateName.length > 80) {
      return { success: false, error: `State name exceeds 80 character limit: ${stateName}` };
    }

    workflow.states.set(stateName, state);
    workflow.updated_at = new Date().toISOString();

    // Auto-set StartAt if this is the first state
    if (workflow.states.size === 1 && !workflow.start_at) {
      workflow.start_at = stateName;
    }

    this._persist(workflowId);

    return {
      success: true,
      state_added: stateName,
      workflow_id: workflowId
    };
  }

  /**
   * Remove a state from a workflow
   * @param {string} workflowId - Workflow ID
   * @param {string} stateName - State name to remove
   * @returns {object} Result
   */
  removeState(workflowId, stateName) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow not found: ${workflowId}` };
    }

    if (!workflow.states.has(stateName)) {
      return { success: false, error: `State not found: ${stateName}` };
    }

    workflow.states.delete(stateName);
    workflow.updated_at = new Date().toISOString();

    // Clear StartAt if we removed the start state
    if (workflow.start_at === stateName) {
      workflow.start_at = null;
    }

    // Remove any references to this state from other states
    for (const [name, state] of workflow.states) {
      if (state.Next === stateName) {
        delete state.Next;
      }
      if (state.Default === stateName) {
        delete state.Default;
      }
      if (state.Choices) {
        for (const choice of state.Choices) {
          if (choice.Next === stateName) {
            delete choice.Next;
          }
        }
      }
    }

    this._persist(workflowId);

    return {
      success: true,
      state_removed: stateName,
      workflow_id: workflowId
    };
  }

  /**
   * Connect two states
   * @param {string} workflowId - Workflow ID
   * @param {string} fromState - Source state name
   * @param {string} toState - Target state name
   * @returns {object} Result
   */
  connectStates(workflowId, fromState, toState) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow not found: ${workflowId}` };
    }

    const source = workflow.states.get(fromState);
    if (!source) {
      return { success: false, error: `Source state not found: ${fromState}` };
    }

    if (!workflow.states.has(toState)) {
      return { success: false, error: `Target state not found: ${toState}` };
    }

    // Can't add Next to terminal states
    if (source.Type === 'Succeed' || source.Type === 'Fail') {
      return { success: false, error: `Cannot add transition from terminal state: ${fromState}` };
    }

    // Can't add Next to Choice states at top level
    if (source.Type === 'Choice') {
      return { success: false, error: `Cannot add Next to Choice state. Use Default instead.` };
    }

    // Remove End if present
    delete source.End;

    // Set Next
    source.Next = toState;
    workflow.updated_at = new Date().toISOString();

    this._persist(workflowId);

    return {
      success: true,
      from: fromState,
      to: toState,
      workflow_id: workflowId
    };
  }

  /**
   * Set the starting state
   * @param {string} workflowId - Workflow ID
   * @param {string} stateName - State name to start with
   * @returns {object} Result
   */
  setStartState(workflowId, stateName) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow not found: ${workflowId}` };
    }

    if (!workflow.states.has(stateName)) {
      return { success: false, error: `State not found: ${stateName}` };
    }

    workflow.start_at = stateName;
    workflow.updated_at = new Date().toISOString();

    this._persist(workflowId);

    return {
      success: true,
      start_at: stateName,
      workflow_id: workflowId
    };
  }

  /**
   * Mark a state as terminal (End: true)
   * @param {string} workflowId - Workflow ID
   * @param {string} stateName - State name
   * @returns {object} Result
   */
  setEndState(workflowId, stateName) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow not found: ${workflowId}` };
    }

    const state = workflow.states.get(stateName);
    if (!state) {
      return { success: false, error: `State not found: ${stateName}` };
    }

    // Can't set End on Choice, Succeed, or Fail states
    if (state.Type === 'Choice' || state.Type === 'Succeed' || state.Type === 'Fail') {
      return { success: false, error: `Cannot set End on ${state.Type} state` };
    }

    // Remove Next if present
    delete state.Next;

    // Set End
    state.End = true;
    workflow.updated_at = new Date().toISOString();

    this._persist(workflowId);

    return {
      success: true,
      end_state: stateName,
      workflow_id: workflowId
    };
  }

  /**
   * Convert workflow to ASL JSON schema
   * @param {string} workflowId - Workflow ID
   * @returns {object} ASL schema or error
   */
  toASL(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { error: `Workflow not found: ${workflowId}` };
    }

    // Build States object
    const states = {};
    for (const [name, state] of workflow.states) {
      states[name] = { ...state };
    }

    // Build ASL schema
    const schema = {
      Comment: workflow.description || workflow.name,
      StartAt: workflow.start_at,
      States: states
    };

    return schema;
  }

  /**
   * Validate a workflow
   * @param {string} workflowId - Workflow ID
   * @returns {object} Validation result { valid, errors, warnings }
   */
  validate(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { valid: false, errors: [`Workflow not found: ${workflowId}`], warnings: [] };
    }

    const schema = this.toASL(workflowId);
    return validateWorkflow(schema);
  }

  /**
   * List all workflows
   * @returns {object} List of workflows
   */
  list() {
    const workflows = [];

    for (const [id, workflow] of this.workflows) {
      workflows.push({
        workflow_id: id,
        name: workflow.name,
        description: workflow.description,
        state_count: workflow.states.size,
        start_at: workflow.start_at,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at
      });
    }

    return { workflows };
  }

  /**
   * Delete a workflow
   * @param {string} workflowId - Workflow ID
   * @returns {object} Result
   */
  delete(workflowId) {
    if (!this.workflows.has(workflowId)) {
      return { success: false, error: `Workflow not found: ${workflowId}` };
    }

    this.workflows.delete(workflowId);
    this._unpersist(workflowId);

    return {
      success: true,
      deleted: workflowId
    };
  }

  /**
   * Import a workflow from an ASL schema
   * @param {string} name - Workflow name
   * @param {object} schema - ASL workflow schema
   * @param {string} description - Optional description
   * @returns {object} Result with workflow_id or error
   */
  importSchema(name, schema, description = '') {
    if (!schema || typeof schema !== 'object') {
      return { success: false, error: 'Schema must be a valid object' };
    }

    if (!schema.States || typeof schema.States !== 'object') {
      return { success: false, error: 'Schema must have a States object' };
    }

    const id = generateWorkflowId();
    const now = new Date().toISOString();

    const workflow = {
      id,
      name,
      description,
      created_at: now,
      updated_at: now,
      start_at: schema.StartAt || null,
      states: new Map()
    };

    // Import all states
    for (const [stateName, stateDefinition] of Object.entries(schema.States)) {
      workflow.states.set(stateName, stateDefinition);
    }

    this.workflows.set(id, workflow);
    this._persist(id);

    return {
      success: true,
      workflow_id: id,
      name,
      state_count: workflow.states.size,
      created_at: now
    };
  }

  /**
   * Reload a single workflow from disk (picks up changes made by external processes).
   * @param {string} workflowId
   * @returns {boolean} true if reloaded
   */
  reload(workflowId) {
    if (!this.fileStore) return false;
    const filePath = `${workflowId}.json`;
    try {
      const all = this.fileStore.loadAll();
      const data = all.get(workflowId);
      if (data) {
        data.states = new Map(Object.entries(data.states || {}));
        this.workflows.set(workflowId, data);
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  /**
   * Reload all workflows from disk (picks up changes made by external processes).
   */
  reloadAll() {
    if (!this.fileStore) return;
    for (const [id, data] of this.fileStore.loadAll()) {
      data.states = new Map(Object.entries(data.states || {}));
      this.workflows.set(id, data);
    }
  }

  /**
   * Clear all workflows (for testing)
   */
  clear() {
    this.workflows.clear();
    if (this.fileStore) this.fileStore.clear();
  }
}
