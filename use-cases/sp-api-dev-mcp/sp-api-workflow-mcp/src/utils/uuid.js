/**
 * UUID and ID generation utilities
 * Uses Node.js built-in crypto module
 */

import { randomUUID } from 'node:crypto';

/**
 * Generate a random UUID v4
 * @returns {string} UUID string
 */
export function generateUUID() {
  return randomUUID();
}

/**
 * Generate a workflow ID with prefix
 * @returns {string} Workflow ID (e.g., "wf_abc123...")
 */
export function generateWorkflowId() {
  return `wf_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/**
 * Generate an execution ID with prefix
 * @returns {string} Execution ID (e.g., "exec_abc123...")
 */
export function generateExecutionId() {
  return `exec_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/**
 * Generate a callback ID with prefix
 * @returns {string} Callback ID (e.g., "cb_abc123...")
 */
export function generateCallbackId() {
  return `cb_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
