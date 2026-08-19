/**
 * State Factory
 *
 * Creates ASL state definitions for different state types.
 * Used by the builder module to generate valid ASL states.
 */

/**
 * Create a Task state for SP-API operations
 *
 * The request spec contains full endpoint details learned from SP-API Discovery MCP:
 * - method: HTTP method (GET, POST, PUT, DELETE)
 * - path: API path (e.g., /orders/v0/orders/{orderId})
 * - pathParams: Path parameter values
 * - queryParams: Query parameters
 * - body: Request body for POST/PUT
 *
 * @param {object} requestSpec - SP-API request specification
 * @param {string} requestSpec.method - HTTP method
 * @param {string} requestSpec.path - API path
 * @param {object} requestSpec.pathParams - Path parameters
 * @param {object} requestSpec.queryParams - Query parameters
 * @param {object} requestSpec.body - Request body
 * @param {object} options - Additional options
 * @param {string} options.resultPath - JSONPath for storing result
 * @param {object} options.retry - Retry configuration
 * @param {Array} options.catch - Catch configuration
 * @returns {object} ASL Task state
 */
export function createTaskState(requestSpec, options = {}) {
  const state = {
    Type: 'Task',
    Resource: 'sp-api',
    Parameters: {
      method: requestSpec.method || 'GET',
      path: requestSpec.path
    }
  };

  // Add path parameters if specified
  if (requestSpec.pathParams && Object.keys(requestSpec.pathParams).length > 0) {
    state.Parameters.pathParams = processParameters(requestSpec.pathParams);
  }

  // Add query parameters if specified
  if (requestSpec.queryParams && Object.keys(requestSpec.queryParams).length > 0) {
    state.Parameters.queryParams = processParameters(requestSpec.queryParams);
  }

  // Add body if specified
  if (requestSpec.body) {
    state.Parameters.body = processParameters(requestSpec.body);
  }

  // Add ResultPath if specified
  if (options.resultPath) {
    state.ResultPath = options.resultPath;
  }

  // Add Retry if specified
  if (options.retry) {
    state.Retry = [buildRetryPolicy(options.retry)];
  }

  // Add Catch if specified
  if (options.catch) {
    state.Catch = options.catch;
  }

  // Default to End: true (will be changed when connected)
  state.End = true;

  return state;
}

/**
 * Create a Fetch Task state for downloading content from URLs
 *
 * Used for fetching content from presigned S3 URLs, report documents,
 * Product Type Definition schemas, etc.
 *
 * @param {object} fetchSpec - Fetch specification
 * @param {string} fetchSpec.url - Static URL to fetch
 * @param {string} fetchSpec.urlPath - JSONPath to URL in state data (e.g., $.schema.link.resource)
 * @param {string} fetchSpec.responseType - 'json' | 'text' | 'base64' (default: 'json')
 * @param {boolean} fetchSpec.decompress - Decompress gzip content (default: false)
 * @param {object} fetchSpec.headers - Custom HTTP headers
 * @param {number} fetchSpec.timeout - Timeout in seconds (default: 30)
 * @param {object} options - Additional options
 * @param {string} options.resultPath - JSONPath for storing result
 * @param {object} options.retry - Retry configuration
 * @returns {object} ASL Task state for fetch
 */
export function createFetchState(fetchSpec, options = {}) {
  const state = {
    Type: 'Task',
    Resource: 'fetch',
    Parameters: {}
  };

  // Set URL - either static or from JSONPath
  if (fetchSpec.url) {
    state.Parameters.url = fetchSpec.url;
  } else if (fetchSpec.urlPath) {
    state.Parameters['url.$'] = fetchSpec.urlPath;
  } else {
    throw new Error('Fetch state requires either url or urlPath');
  }

  // Response type
  if (fetchSpec.responseType) {
    state.Parameters.responseType = fetchSpec.responseType;
  }

  // Decompression
  if (fetchSpec.decompress !== undefined) {
    state.Parameters.decompress = fetchSpec.decompress;
  }

  // Custom headers
  if (fetchSpec.headers && Object.keys(fetchSpec.headers).length > 0) {
    state.Parameters.headers = fetchSpec.headers;
  }

  // Timeout
  if (fetchSpec.timeout !== undefined) {
    state.Parameters.timeout = fetchSpec.timeout;
  }

  // Output path - save to local file instead of returning content
  if (fetchSpec.outputPath) {
    state.Parameters.outputPath = fetchSpec.outputPath;
  } else if (fetchSpec.outputPathExpr) {
    state.Parameters['outputPath.$'] = fetchSpec.outputPathExpr;
  }

  // Add ResultPath if specified
  if (options.resultPath) {
    state.ResultPath = options.resultPath;
  }

  // Add Retry if specified
  if (options.retry) {
    state.Retry = [buildRetryPolicy(options.retry)];
  }

  // Add Catch if specified
  if (options.catch) {
    state.Catch = options.catch;
  }

  // Default to End: true (will be changed when connected)
  state.End = true;

  return state;
}

/**
 * Create a callback Task state for human interaction
 *
 * @param {string} prompt - Prompt to show the human
 * @param {object} options - Additional options
 * @param {object} options.details - Additional context details
 * @param {string} options.resultPath - JSONPath for storing result
 * @param {number} options.timeoutSeconds - Timeout in seconds
 * @param {string} options.timeoutAction - Action on timeout: 'fail' | 'default'
 * @param {Array} options.channels - Notification channels: ['console', 'webhook']
 * @returns {object} ASL Task state for callback
 */
export function createCallbackState(prompt, options = {}) {
  const state = {
    Type: 'Task',
    Resource: 'callback',
    Parameters: {
      prompt,
      response_schema: { type: 'approval' }
    }
  };

  if (options.details) {
    state.Parameters.details = processParameters(options.details);
  }

  if (options.timeoutSeconds) {
    state.Parameters.timeout_seconds = options.timeoutSeconds;
  }

  if (options.timeoutAction) {
    state.Parameters.timeout_action = options.timeoutAction;
  }

  if (options.channels) {
    state.Parameters.channels = options.channels;
  }

  if (options.resultPath) {
    state.ResultPath = options.resultPath;
  }

  state.End = true;

  return state;
}

/**
 * Create a Choice state for conditional branching
 *
 * @param {Array} choices - Array of choice rules
 * @param {string} choices[].variable - JSONPath to variable
 * @param {string} choices[].comparison - Comparison operator
 * @param {any} choices[].value - Value to compare
 * @param {string} choices[].next - Next state if condition matches
 * @param {string} defaultState - Default state if no match
 * @returns {object} ASL Choice state
 */
export function createChoiceState(choices, defaultState) {
  const state = {
    Type: 'Choice',
    Choices: choices.map(buildChoiceRule)
  };

  if (defaultState) {
    state.Default = defaultState;
  }

  return state;
}

/**
 * Build a choice rule from simplified input
 */
function buildChoiceRule(rule) {
  const choiceRule = {
    Variable: rule.variable,
    Next: rule.next
  };

  // Map comparison operators
  const comparison = rule.comparison || 'StringEquals';
  choiceRule[comparison] = rule.value;

  return choiceRule;
}

/**
 * Create a Wait state
 *
 * @param {number} seconds - Seconds to wait
 * @returns {object} ASL Wait state
 */
export function createWaitState(seconds) {
  return {
    Type: 'Wait',
    Seconds: seconds,
    End: true
  };
}

/**
 * Create a Succeed state
 *
 * @returns {object} ASL Succeed state
 */
export function createSucceedState() {
  return {
    Type: 'Succeed'
  };
}

/**
 * Create a Fail state
 *
 * @param {string} error - Error name
 * @param {string} cause - Error cause
 * @returns {object} ASL Fail state
 */
export function createFailState(error = 'WorkflowFailed', cause = 'Workflow execution failed') {
  return {
    Type: 'Fail',
    Error: error,
    Cause: cause
  };
}

/**
 * Create a Pass state
 *
 * @param {any} result - Optional fixed result
 * @param {string} resultPath - Optional result path
 * @returns {object} ASL Pass state
 */
export function createPassState(result, resultPath) {
  const state = {
    Type: 'Pass',
    End: true
  };

  if (result !== undefined) {
    state.Result = result;
  }

  if (resultPath) {
    state.ResultPath = resultPath;
  }

  return state;
}

/**
 * Create a Parallel state
 *
 * @param {Array} branches - Array of branch workflows
 * @param {object} options - Additional options
 * @returns {object} ASL Parallel state
 */
export function createParallelState(branches, options = {}) {
  const state = {
    Type: 'Parallel',
    Branches: branches,
    End: true
  };

  if (options.resultPath) {
    state.ResultPath = options.resultPath;
  }

  if (options.retry) {
    state.Retry = [buildRetryPolicy(options.retry)];
  }

  if (options.catch) {
    state.Catch = options.catch;
  }

  return state;
}

/**
 * Create a Map state
 *
 * @param {object} itemProcessor - The workflow to run for each item
 * @param {object} options - Additional options
 * @param {string} options.itemsPath - JSONPath to the array to iterate
 * @param {string} options.resultPath - JSONPath for result
 * @returns {object} ASL Map state
 */
export function createMapState(itemProcessor, options = {}) {
  const state = {
    Type: 'Map',
    ItemProcessor: itemProcessor,
    End: true
  };

  if (options.itemsPath) {
    state.ItemsPath = options.itemsPath;
  }

  if (options.resultPath) {
    state.ResultPath = options.resultPath;
  }

  if (options.retry) {
    state.Retry = [buildRetryPolicy(options.retry)];
  }

  if (options.catch) {
    state.Catch = options.catch;
  }

  return state;
}

/**
 * Process parameters, converting JSONPath references
 * Converts { "foo": "$.bar" } to { "foo.$": "$.bar" }
 *
 * @param {object} params - Parameters object
 * @returns {object} Processed parameters
 */
function processParameters(params) {
  if (params === null || params === undefined) {
    return params;
  }

  // Preserve arrays as-is (don't convert to objects)
  if (Array.isArray(params)) {
    return params.map(item => {
      if (typeof item === 'object' && item !== null) {
        return processParameters(item);
      }
      return item;
    });
  }

  if (typeof params !== 'object') {
    return params;
  }

  const processed = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.startsWith('$.') && !key.endsWith('.$')) {
      // This is a JSONPath reference - add .$ suffix to key
      processed[`${key}.$`] = value;
    } else if (Array.isArray(value)) {
      // Preserve arrays
      processed[key] = processParameters(value);
    } else if (typeof value === 'object' && value !== null) {
      // Recursively process nested objects
      processed[key] = processParameters(value);
    } else {
      processed[key] = value;
    }
  }

  return processed;
}

/**
 * Build a retry policy from simplified config
 *
 * @param {object} config - Retry configuration
 * @returns {object} ASL retry policy
 */
function buildRetryPolicy(config) {
  return {
    ErrorEquals: config.errorEquals || ['States.TaskFailed', 'States.Timeout'],
    IntervalSeconds: config.interval_seconds || config.intervalSeconds || 2,
    MaxAttempts: config.max_attempts || config.maxAttempts || 3,
    BackoffRate: config.backoff_rate || config.backoffRate || 2.0
  };
}
