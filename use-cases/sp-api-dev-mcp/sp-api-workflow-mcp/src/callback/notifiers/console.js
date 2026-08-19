/**
 * Console Notifier
 *
 * Outputs callback notifications to the console.
 * For MVP, this is the primary notification method.
 */

/**
 * Notify about a callback via console
 *
 * @param {object} callback - Callback object
 * @param {string} callback.id - Callback ID
 * @param {string} callback.prompt - Prompt message
 * @param {object} callback.details - Additional details
 * @param {string} callback.expires_at - Expiration time
 */
export function notifyConsole(callback) {
  const separator = '═'.repeat(60);
  const lines = [
    '',
    separator,
    '  APPROVAL REQUIRED',
    separator,
    '',
    `  Callback ID: ${callback.id}`,
    `  Execution:   ${callback.execution_id}`,
    `  State:       ${callback.state_name}`,
    '',
    `  ${callback.prompt}`,
    ''
  ];

  // Add details if present
  if (callback.details) {
    lines.push('  Details:');
    if (typeof callback.details === 'object') {
      for (const [key, value] of Object.entries(callback.details)) {
        const displayValue = typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
        lines.push(`    ${key}: ${displayValue}`);
      }
    } else {
      lines.push(`    ${callback.details}`);
    }
    lines.push('');
  }

  // Add expiry info
  if (callback.expires_at) {
    const expiresIn = Math.round((new Date(callback.expires_at) - Date.now()) / 1000);
    lines.push(`  Expires in: ${expiresIn} seconds`);
    lines.push('');
  }

  // Add instructions
  lines.push('  To respond, use:');
  lines.push(`    submit_callback(callback_id="${callback.id}", approved=true|false)`);
  lines.push('');
  lines.push(separator);
  lines.push('');

  // Output to stderr (so it doesn't interfere with MCP protocol on stdout)
  console.error(lines.join('\n'));
}

/**
 * Format callback for display
 *
 * @param {object} callback - Callback object
 * @returns {string} Formatted callback string
 */
export function formatCallback(callback) {
  const lines = [
    `Callback ID: ${callback.id}`,
    `Status: ${callback.status}`,
    `Prompt: ${callback.prompt}`,
    `Execution: ${callback.execution_id}`,
    `State: ${callback.state_name}`,
    `Created: ${callback.created_at}`
  ];

  if (callback.expires_at) {
    lines.push(`Expires: ${callback.expires_at}`);
  }

  if (callback.resolved_at) {
    lines.push(`Resolved: ${callback.resolved_at}`);
  }

  return lines.join('\n');
}

/**
 * Format callback list for display
 *
 * @param {Array} callbacks - Array of callbacks
 * @returns {string} Formatted list
 */
export function formatCallbackList(callbacks) {
  if (callbacks.length === 0) {
    return 'No pending callbacks';
  }

  const items = callbacks.map((cb, index) => {
    return [
      `${index + 1}. ${cb.id}`,
      `   Status: ${cb.status}`,
      `   Prompt: ${cb.prompt}`,
      `   Created: ${cb.created_at}`
    ].join('\n');
  });

  return items.join('\n\n');
}
