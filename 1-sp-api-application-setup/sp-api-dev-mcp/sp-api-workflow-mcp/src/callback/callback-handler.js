/**
 * Callback Handler
 *
 * Coordinates callback creation, notification, and resolution.
 * Used by the interpreter to handle human interaction tasks.
 */

import { CallbackStore, CallbackStatus } from './callback-store.js';
import { notifyConsole } from './notifiers/console.js';

/**
 * Callback Handler class
 * Manages the full callback lifecycle
 */
export class CallbackHandler {
  /**
   * @param {object} options
   * @param {CallbackStore} options.store - Optional callback store instance
   */
  constructor(options = {}) {
    this.store = options.store || new CallbackStore(options.storeOptions);
    this.notifiers = {
      console: notifyConsole
    };
  }

  /**
   * Create a callback and send notifications
   *
   * @param {string} executionId - Execution ID
   * @param {string} stateName - State name
   * @param {string} prompt - Human-readable prompt
   * @param {object} options - Callback options
   * @returns {Promise<object>} Created callback
   */
  async createCallback(executionId, stateName, prompt, options = {}) {
    // Create the callback
    const callback = this.store.create(executionId, stateName, prompt, options);

    // Send notifications
    const channels = options.channels || ['console'];
    for (const channel of channels) {
      if (this.notifiers[channel]) {
        try {
          await this.notifiers[channel](callback);
        } catch (error) {
          console.error(`Failed to notify via ${channel}:`, error.message);
        }
      }
    }

    return callback;
  }

  /**
   * Wait for a callback to be resolved
   *
   * @param {string} callbackId - Callback ID
   * @returns {Promise<object>} Callback response
   */
  async waitForCallback(callbackId) {
    return this.store.waitForResolution(callbackId);
  }

  /**
   * Submit a callback response
   *
   * @param {string} callbackId - Callback ID
   * @param {boolean} approved - Whether approved
   * @param {string} comment - Optional comment
   * @param {object} data - Optional additional data
   * @returns {object} Resolution result
   */
  submitCallback(callbackId, approved, comment = '', data = {}) {
    return this.store.resolve(callbackId, {
      approved,
      comment,
      data
    });
  }

  /**
   * Get callback details
   *
   * @param {string} callbackId - Callback ID
   * @returns {object|null} Callback or null
   */
  getCallback(callbackId) {
    return this.store.get(callbackId);
  }

  /**
   * List pending callbacks
   *
   * @param {object} filters - Filter options
   * @returns {Array} Array of callbacks
   */
  listPending(filters = {}) {
    return this.store.list({
      ...filters,
      status: CallbackStatus.PENDING
    });
  }

  /**
   * List all callbacks
   *
   * @param {object} filters - Filter options
   * @returns {Array} Array of callbacks
   */
  listCallbacks(filters = {}) {
    return this.store.list(filters);
  }

  /**
   * Extend callback timeout
   *
   * @param {string} callbackId - Callback ID
   * @param {number} additionalSeconds - Seconds to add
   * @returns {object} Result
   */
  extendTimeout(callbackId, additionalSeconds) {
    return this.store.extendTimeout(callbackId, additionalSeconds);
  }

  /**
   * Cancel a pending callback
   *
   * @param {string} callbackId - Callback ID
   * @returns {object} Result
   */
  cancelCallback(callbackId) {
    return this.store.cancel(callbackId);
  }

  /**
   * Add a custom notifier
   *
   * @param {string} name - Notifier name
   * @param {Function} handler - Notifier function
   */
  addNotifier(name, handler) {
    this.notifiers[name] = handler;
  }

  /**
   * Clear all callbacks (for testing)
   */
  clear() {
    this.store.clear();
  }
}
