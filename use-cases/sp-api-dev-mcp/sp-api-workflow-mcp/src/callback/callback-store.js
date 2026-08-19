/**
 * Callback Store
 *
 * Manages pending human interaction callbacks.
 * Supports timeout, notification channels, and callback resolution.
 */

import { generateCallbackId } from '../utils/uuid.js';
import { FileStore } from '../utils/file-store.js';

/**
 * Callback status constants
 */
export const CallbackStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  TIMED_OUT: 'TIMED_OUT',
  CANCELLED: 'CANCELLED'
};

/**
 * Callback Store class
 * Manages pending callbacks for human interaction
 */
export class CallbackStore {
  /**
   * @param {object} [options]
   * @param {string} [options.dataDir] - Directory for file persistence. If omitted, in-memory only.
   */
  constructor(options = {}) {
    this.callbacks = new Map();
    this.resolvers = new Map();  // non-serializable, in-memory only
    this.timeouts = new Map();   // non-serializable, in-memory only
    this.fileStore = options.dataDir ? new FileStore(options.dataDir) : null;

    if (this.fileStore) {
      for (const [id, data] of this.fileStore.loadAll()) {
        this.callbacks.set(id, data);
      }
    }
  }

  _persist(id) {
    if (!this.fileStore) return;
    const cb = this.callbacks.get(id);
    if (cb) this.fileStore.save(id, cb);
  }

  _unpersist(id) {
    if (this.fileStore) this.fileStore.remove(id);
  }

  /**
   * Create a new callback
   *
   * @param {string} executionId - Execution ID
   * @param {string} stateName - State that requested the callback
   * @param {string} prompt - Human-readable prompt
   * @param {object} options - Callback options
   * @param {object} options.details - Additional context details
   * @param {number} options.timeoutSeconds - Timeout in seconds
   * @param {string} options.timeoutAction - Action on timeout: 'fail' | 'default'
   * @param {object} options.defaultResponse - Default response on timeout (if timeoutAction is 'default')
   * @param {Array} options.channels - Notification channels
   * @returns {object} Created callback
   */
  create(executionId, stateName, prompt, options = {}) {
    const callbackId = generateCallbackId();
    const now = new Date().toISOString();

    const callback = {
      id: callbackId,
      execution_id: executionId,
      state_name: stateName,
      prompt: prompt,
      details: options.details || null,
      status: CallbackStatus.PENDING,
      timeout_seconds: options.timeoutSeconds || null,
      timeout_action: options.timeoutAction || 'fail',
      default_response: options.defaultResponse || null,
      channels: options.channels || ['console'],
      response: null,
      created_at: now,
      resolved_at: null,
      expires_at: options.timeoutSeconds
        ? new Date(Date.now() + options.timeoutSeconds * 1000).toISOString()
        : null,
      // Input state fields
      input_type: options.inputType || null,
      input_request: options.inputRequest || null
    };

    this.callbacks.set(callbackId, callback);
    this._persist(callbackId);

    return callback;
  }

  /**
   * Get a callback by ID
   *
   * @param {string} callbackId - Callback ID
   * @returns {object|null} Callback or null
   */
  get(callbackId) {
    return this.callbacks.get(callbackId) || null;
  }

  /**
   * Resolve a callback with a response
   *
   * @param {string} callbackId - Callback ID
   * @param {object} response - Response object
   * @param {boolean} response.approved - Whether approved
   * @param {string} response.comment - Optional comment
   * @param {object} response.data - Optional additional data
   * @returns {object} Resolution result
   */
  resolve(callbackId, response) {
    const callback = this.callbacks.get(callbackId);
    if (!callback) {
      return { success: false, error: `Callback not found: ${callbackId}` };
    }

    if (callback.status !== CallbackStatus.PENDING) {
      return {
        success: false,
        error: `Callback already resolved with status: ${callback.status}`
      };
    }

    // Clear any pending timeout
    const timeout = this.timeouts.get(callbackId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(callbackId);
    }

    // Update callback
    callback.status = response.approved ? CallbackStatus.APPROVED : CallbackStatus.REJECTED;
    callback.response = response;
    callback.resolved_at = new Date().toISOString();

    // Resolve any waiting promise
    const resolver = this.resolvers.get(callbackId);
    if (resolver) {
      resolver.resolve(response);
      this.resolvers.delete(callbackId);
    }

    this._persist(callbackId);

    return {
      success: true,
      callback_id: callbackId,
      status: callback.status
    };
  }

  /**
   * Wait for a callback to be resolved
   *
   * @param {string} callbackId - Callback ID
   * @returns {Promise<object>} Response when resolved
   */
  waitForResolution(callbackId) {
    const callback = this.callbacks.get(callbackId);
    if (!callback) {
      return Promise.reject(new Error(`Callback not found: ${callbackId}`));
    }

    // Already resolved
    if (callback.status !== CallbackStatus.PENDING) {
      if (callback.status === CallbackStatus.TIMED_OUT) {
        if (callback.timeout_action === 'default' && callback.default_response) {
          return Promise.resolve(callback.default_response);
        }
        return Promise.reject(new Error(`Callback timed out: ${callbackId}`));
      }
      return Promise.resolve(callback.response);
    }

    // Create promise to wait for resolution
    return new Promise((resolve, reject) => {
      this.resolvers.set(callbackId, { resolve, reject });

      // Set up timeout if configured
      if (callback.timeout_seconds) {
        const timeout = setTimeout(() => {
          this.handleTimeout(callbackId);
        }, callback.timeout_seconds * 1000);

        this.timeouts.set(callbackId, timeout);
      }
    });
  }

  /**
   * Handle callback timeout
   *
   * @param {string} callbackId - Callback ID
   */
  handleTimeout(callbackId) {
    const callback = this.callbacks.get(callbackId);
    if (!callback || callback.status !== CallbackStatus.PENDING) {
      return;
    }

    callback.status = CallbackStatus.TIMED_OUT;
    callback.resolved_at = new Date().toISOString();

    // Clean up timeout
    this.timeouts.delete(callbackId);
    this._persist(callbackId);

    // Resolve or reject the waiting promise
    const resolver = this.resolvers.get(callbackId);
    if (resolver) {
      if (callback.timeout_action === 'default' && callback.default_response) {
        resolver.resolve(callback.default_response);
      } else {
        resolver.reject(new Error(`Callback timed out: ${callbackId}`));
      }
      this.resolvers.delete(callbackId);
    }
  }

  /**
   * Cancel a pending callback
   *
   * @param {string} callbackId - Callback ID
   * @returns {object} Result
   */
  cancel(callbackId) {
    const callback = this.callbacks.get(callbackId);
    if (!callback) {
      return { success: false, error: `Callback not found: ${callbackId}` };
    }

    if (callback.status !== CallbackStatus.PENDING) {
      return {
        success: false,
        error: `Callback already resolved with status: ${callback.status}`
      };
    }

    // Clear timeout
    const timeout = this.timeouts.get(callbackId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(callbackId);
    }

    // Update callback
    callback.status = CallbackStatus.CANCELLED;
    callback.resolved_at = new Date().toISOString();
    this._persist(callbackId);

    // Reject any waiting promise
    const resolver = this.resolvers.get(callbackId);
    if (resolver) {
      resolver.reject(new Error(`Callback cancelled: ${callbackId}`));
      this.resolvers.delete(callbackId);
    }

    return { success: true, callback_id: callbackId };
  }

  /**
   * Extend callback timeout
   *
   * @param {string} callbackId - Callback ID
   * @param {number} additionalSeconds - Seconds to add
   * @returns {object} Result
   */
  extendTimeout(callbackId, additionalSeconds) {
    const callback = this.callbacks.get(callbackId);
    if (!callback) {
      return { success: false, error: `Callback not found: ${callbackId}` };
    }

    if (callback.status !== CallbackStatus.PENDING) {
      return {
        success: false,
        error: `Cannot extend timeout for resolved callback: ${callback.status}`
      };
    }

    // Clear existing timeout
    const existingTimeout = this.timeouts.get(callbackId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Calculate new expiry
    const currentExpiry = callback.expires_at
      ? new Date(callback.expires_at).getTime()
      : Date.now();
    const newExpiry = new Date(currentExpiry + additionalSeconds * 1000);

    callback.expires_at = newExpiry.toISOString();
    callback.timeout_seconds = (callback.timeout_seconds || 0) + additionalSeconds;

    // Set new timeout
    const remainingMs = newExpiry.getTime() - Date.now();
    if (remainingMs > 0) {
      const timeout = setTimeout(() => {
        this.handleTimeout(callbackId);
      }, remainingMs);
      this.timeouts.set(callbackId, timeout);
    }

    return {
      success: true,
      callback_id: callbackId,
      new_expires_at: callback.expires_at
    };
  }

  /**
   * List callbacks with optional filters
   *
   * @param {object} filters - Filter options
   * @param {string} filters.execution_id - Filter by execution ID
   * @param {string} filters.status - Filter by status
   * @param {number} filters.limit - Maximum results
   * @returns {Array} Array of callbacks
   */
  list(filters = {}) {
    let results = Array.from(this.callbacks.values());

    // Filter by execution ID
    if (filters.execution_id) {
      results = results.filter(c => c.execution_id === filters.execution_id);
    }

    // Filter by status
    if (filters.status) {
      results = results.filter(c => c.status === filters.status);
    }

    // Sort by created_at descending
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Apply limit
    if (filters.limit && filters.limit > 0) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get pending callbacks
   *
   * @returns {Array} Array of pending callbacks
   */
  getPending() {
    return this.list({ status: CallbackStatus.PENDING });
  }

  /**
   * Delete a callback
   *
   * @param {string} callbackId - Callback ID
   * @returns {boolean} True if deleted
   */
  delete(callbackId) {
    // Clean up associated resources
    const timeout = this.timeouts.get(callbackId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(callbackId);
    }

    const resolver = this.resolvers.get(callbackId);
    if (resolver) {
      resolver.reject(new Error(`Callback deleted: ${callbackId}`));
      this.resolvers.delete(callbackId);
    }

    this._unpersist(callbackId);
    return this.callbacks.delete(callbackId);
  }

  /**
   * Clear all callbacks (for testing)
   */
  clear() {
    // Clear all timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }

    // Reject all resolvers
    for (const resolver of this.resolvers.values()) {
      resolver.reject(new Error('Callback store cleared'));
    }

    this.callbacks.clear();
    this.resolvers.clear();
    this.timeouts.clear();
    if (this.fileStore) this.fileStore.clear();
  }
}
