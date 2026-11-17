/**
 * Task Handlers
 *
 * Handles execution of different task types in ASL workflows.
 * - SP-API tasks: Call SP-API endpoints
 * - Fetch tasks: Download content from URLs (S3, reports, schemas)
 * - Callback tasks: Human interaction
 * - Local tasks: Custom local processing
 */

import { SPAPIError } from '../sp-api-core/client.js';
import { resolveParameters } from '../utils/json-path.js';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const https = require('https');
const http = require('http');
const zlib = require('zlib');

/**
 * Handle Fetch task execution
 *
 * Downloads content from URLs (presigned S3 URLs, report documents, schemas).
 * Supports JSON, text, and binary responses with optional gzip decompression.
 * Can save results to a local file instead of returning the full content.
 *
 * @param {object} state - ASL state definition with Parameters
 * @param {object} state.Parameters.url - URL to fetch
 * @param {string} state.Parameters.responseType - 'json' | 'text' | 'base64' (default: 'json')
 * @param {boolean} state.Parameters.decompress - Decompress gzip response (default: false)
 * @param {object} state.Parameters.headers - Custom HTTP headers
 * @param {number} state.Parameters.timeout - Request timeout in seconds (default: 30)
 * @param {string} state.Parameters.outputPath - Save content to this local file path (optional)
 * @returns {Promise<any>} Fetched content, or file metadata if outputPath is specified
 */
export async function handleFetchTask(state) {
  const parameters = state.Parameters || {};
  const url = parameters.url;

  if (!url) {
    throw new TaskError(
      'MissingURL',
      'Fetch task requires "url" in Parameters'
    );
  }

  const responseType = parameters.responseType || 'json';
  const decompress = parameters.decompress || false;
  const customHeaders = parameters.headers || {};
  const timeoutMs = (parameters.timeout || 30) * 1000;
  const outputPath = parameters.outputPath;

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Accept': responseType === 'json' ? 'application/json' : '*/*',
        'Accept-Encoding': decompress ? 'gzip, deflate' : 'identity',
        ...customHeaders
      },
      timeout: timeoutMs
    };

    const req = protocol.request(requestOptions, (res) => {
      const statusCode = res.statusCode;

      // Handle redirects
      if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
        // Follow redirect
        const redirectState = {
          ...state,
          Parameters: {
            ...parameters,
            url: res.headers.location
          }
        };
        handleFetchTask(redirectState).then(resolve).catch(reject);
        return;
      }

      // Check for errors
      if (statusCode >= 400) {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          reject(new TaskError(
            statusCode >= 500 ? 'States.TaskFailed' : 'FetchError',
            `Fetch failed with status ${statusCode}: ${body.substring(0, 200)}`,
            { status: statusCode, retryable: statusCode >= 500 }
          ));
        });
        return;
      }

      // Handle response based on content encoding
      let stream = res;
      const contentEncoding = res.headers['content-encoding'];

      if (contentEncoding === 'gzip' || decompress) {
        stream = res.pipe(zlib.createGunzip());
      } else if (contentEncoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      }

      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('error', (err) => {
        reject(new TaskError(
          'FetchError',
          `Stream error: ${err.message}`
        ));
      });
      stream.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          let content;

          switch (responseType) {
            case 'json': {
              const text = buffer.toString('utf8');
              content = JSON.parse(text);
              break;
            }
            case 'text': {
              content = buffer.toString('utf8');
              break;
            }
            case 'base64': {
              content = buffer.toString('base64');
              break;
            }
            default:
              content = buffer.toString('utf8');
          }

          // If outputPath is specified, save to file and return metadata
          if (outputPath) {
            try {
              // Ensure directory exists
              const dir = path.dirname(outputPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }

              // Write content to file
              const fileContent = responseType === 'json'
                ? JSON.stringify(content, null, 2)
                : content;
              fs.writeFileSync(outputPath, fileContent, 'utf8');

              // Return metadata instead of full content
              resolve({
                saved: true,
                path: outputPath,
                size: Buffer.byteLength(fileContent, 'utf8'),
                responseType: responseType
              });
            } catch (fileErr) {
              reject(new TaskError(
                'FetchSaveError',
                `Failed to save fetch result to ${outputPath}: ${fileErr.message}`
              ));
            }
          } else {
            // Return content directly
            resolve(content);
          }
        } catch (err) {
          reject(new TaskError(
            'FetchParseError',
            `Failed to parse response as ${responseType}: ${err.message}`
          ));
        }
      });
    });

    req.on('error', (err) => {
      reject(new TaskError(
        'States.TaskFailed',
        `Fetch request failed: ${err.message}`,
        { retryable: true }
      ));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new TaskError(
        'States.Timeout',
        `Fetch request timed out after ${timeoutMs}ms`,
        { retryable: true }
      ));
    });

    req.end();
  });
}

/**
 * Handle SP-API task execution
 *
 * The workflow task contains full request specification:
 * - method: HTTP method (GET, POST, PUT, DELETE)
 * - path: API path (e.g., /orders/v0/orders/{orderId})
 * - pathParams: Path parameter values
 * - queryParams: Query parameters
 * - body: Request body for POST/PUT
 *
 * @param {object} state - ASL state definition
 * @param {object} input - Resolved input parameters
 * @param {object} spApiClient - SP-API client instance
 * @returns {Promise<object>} SP-API response
 */
export async function handleSPAPITask(state, input, spApiClient) {
  if (!spApiClient) {
    throw new TaskError(
      'SPAPIClientNotConfigured',
      'SP-API client is not configured. Set SP_API credentials.'
    );
  }

  const parameters = state.Parameters || {};

  // Build request specification from workflow parameters
  const requestSpec = {
    method: parameters.method || 'GET',
    path: parameters.path,
    pathParams: parameters.pathParams || {},
    queryParams: parameters.queryParams || {},
    body: parameters.body,
    headers: parameters.headers || {}
  };

  if (!requestSpec.path) {
    throw new TaskError(
      'MissingPath',
      'SP-API task requires "path" in Parameters (e.g., /orders/v0/orders)'
    );
  }

  try {
    const result = await spApiClient.execute(requestSpec);
    return result;
  } catch (error) {
    if (error instanceof SPAPIError) {
      throw new TaskError(
        error.isRetryable() ? 'States.TaskFailed' : 'SPAPIError',
        `SP-API error: ${error.status} ${error.message}`,
        {
          request: requestSpec,  // Include full request for debugging
          status: error.status,
          retryable: error.isRetryable(),
          response: error.body   // Include full error response
        }
      );
    }
    throw error;
  }
}

/**
 * Handle callback task (human interaction)
 *
 * @param {object} state - ASL state definition
 * @param {object} input - Resolved input
 * @param {object} callbackHandler - Callback handler instance
 * @param {object} executionContext - Current execution context
 * @returns {Promise<object>} Callback response (when resolved)
 */
export async function handleCallbackTask(state, input, callbackHandler, executionContext) {
  if (!callbackHandler) {
    throw new TaskError(
      'CallbackHandlerNotConfigured',
      'Callback handler is not configured'
    );
  }

  const parameters = state.Parameters || {};
  const prompt = parameters.prompt || 'Approval required';
  const options = {
    details: parameters.details || input,
    timeoutSeconds: parameters.timeout_seconds,
    timeoutAction: parameters.timeout_action || 'fail',
    channels: parameters.channels || ['console']
  };

  // Create callback and wait for resolution
  const callback = await callbackHandler.createCallback(
    executionContext.executionId,
    executionContext.stateName,
    prompt,
    options
  );

  // Wait for callback resolution
  const response = await callbackHandler.waitForCallback(callback.id);

  return response;
}

/**
 * Handle pass state (data transformation)
 *
 * @param {object} state - ASL state definition
 * @param {object} input - Current input
 * @returns {object} Result
 */
export function handlePassState(state, input) {
  // If Parameters is specified, resolve it with intrinsic functions
  if (state.Parameters !== undefined) {
    return resolveParameters(state.Parameters, input);
  }

  // If Result is specified, use it
  if (state.Result !== undefined) {
    return state.Result;
  }

  // Otherwise pass through input
  return input;
}

/**
 * Handle wait state
 *
 * @param {object} state - ASL state definition
 * @param {object} input - Current input
 * @returns {Promise<object>} Input after waiting
 */
export async function handleWaitState(state, input) {
  let waitMs = 0;

  if (state.Seconds !== undefined) {
    waitMs = state.Seconds * 1000;
  } else if (state.SecondsPath !== undefined) {
    // SecondsPath is already resolved in input
    throw new TaskError(
      'WaitSecondsPathNotSupported',
      'SecondsPath is not supported in MVP. Use Seconds instead.'
    );
  } else if (state.Timestamp !== undefined || state.TimestampPath !== undefined) {
    throw new TaskError(
      'WaitTimestampNotSupported',
      'Timestamp waiting is not supported in MVP. Use Seconds instead.'
    );
  }

  // For MVP, cap wait at 60 seconds to avoid blocking
  const maxWait = 60000;
  if (waitMs > maxWait) {
    console.warn(`Wait time ${waitMs}ms exceeds max ${maxWait}ms. Capping at max.`);
    waitMs = maxWait;
  }

  if (waitMs > 0) {
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  return input;
}

/**
 * Evaluate choice state conditions
 *
 * @param {object} state - ASL Choice state
 * @param {object} input - Current input
 * @returns {string|null} Next state name or null if no match
 */
export function evaluateChoiceState(state, input) {
  const choices = state.Choices || [];

  for (const choice of choices) {
    if (evaluateChoiceRule(choice, input)) {
      return choice.Next;
    }
  }

  // No match - return default
  return state.Default || null;
}

/**
 * Evaluate a single choice rule
 *
 * @param {object} rule - Choice rule
 * @param {object} input - Input data
 * @returns {boolean} True if rule matches
 */
function evaluateChoiceRule(rule, input) {
  const variable = getVariableValue(rule.Variable, input);

  // String comparisons
  if (rule.StringEquals !== undefined) {
    return variable === rule.StringEquals;
  }
  if (rule.StringEqualsPath !== undefined) {
    return variable === getVariableValue(rule.StringEqualsPath, input);
  }
  if (rule.StringLessThan !== undefined) {
    return variable < rule.StringLessThan;
  }
  if (rule.StringGreaterThan !== undefined) {
    return variable > rule.StringGreaterThan;
  }
  if (rule.StringLessThanEquals !== undefined) {
    return variable <= rule.StringLessThanEquals;
  }
  if (rule.StringGreaterThanEquals !== undefined) {
    return variable >= rule.StringGreaterThanEquals;
  }

  // Numeric comparisons
  if (rule.NumericEquals !== undefined) {
    return variable === rule.NumericEquals;
  }
  if (rule.NumericEqualsPath !== undefined) {
    return variable === getVariableValue(rule.NumericEqualsPath, input);
  }
  if (rule.NumericLessThan !== undefined) {
    return variable < rule.NumericLessThan;
  }
  if (rule.NumericLessThanPath !== undefined) {
    return variable < getVariableValue(rule.NumericLessThanPath, input);
  }
  if (rule.NumericGreaterThan !== undefined) {
    return variable > rule.NumericGreaterThan;
  }
  if (rule.NumericGreaterThanPath !== undefined) {
    return variable > getVariableValue(rule.NumericGreaterThanPath, input);
  }
  if (rule.NumericLessThanEquals !== undefined) {
    return variable <= rule.NumericLessThanEquals;
  }
  if (rule.NumericLessThanEqualsPath !== undefined) {
    return variable <= getVariableValue(rule.NumericLessThanEqualsPath, input);
  }
  if (rule.NumericGreaterThanEquals !== undefined) {
    return variable >= rule.NumericGreaterThanEquals;
  }
  if (rule.NumericGreaterThanEqualsPath !== undefined) {
    return variable >= getVariableValue(rule.NumericGreaterThanEqualsPath, input);
  }

  // Boolean comparisons
  if (rule.BooleanEquals !== undefined) {
    return variable === rule.BooleanEquals;
  }
  if (rule.BooleanEqualsPath !== undefined) {
    return variable === getVariableValue(rule.BooleanEqualsPath, input);
  }

  // Timestamp comparisons (basic - treats as strings)
  if (rule.TimestampEquals !== undefined) {
    return variable === rule.TimestampEquals;
  }
  if (rule.TimestampLessThan !== undefined) {
    return variable < rule.TimestampLessThan;
  }
  if (rule.TimestampGreaterThan !== undefined) {
    return variable > rule.TimestampGreaterThan;
  }

  // Type checks
  if (rule.IsNull !== undefined) {
    return (variable === null) === rule.IsNull;
  }
  if (rule.IsPresent !== undefined) {
    return (variable !== undefined) === rule.IsPresent;
  }
  if (rule.IsNumeric !== undefined) {
    return (typeof variable === 'number') === rule.IsNumeric;
  }
  if (rule.IsString !== undefined) {
    return (typeof variable === 'string') === rule.IsString;
  }
  if (rule.IsBoolean !== undefined) {
    return (typeof variable === 'boolean') === rule.IsBoolean;
  }

  // Pattern matching
  if (rule.StringMatches !== undefined) {
    return matchPattern(variable, rule.StringMatches);
  }

  // Logical operators
  if (rule.Not !== undefined) {
    return !evaluateChoiceRule(rule.Not, input);
  }
  if (rule.And !== undefined) {
    return rule.And.every(r => evaluateChoiceRule(r, input));
  }
  if (rule.Or !== undefined) {
    return rule.Or.some(r => evaluateChoiceRule(r, input));
  }

  // Unknown rule - default to false
  return false;
}

/**
 * Get variable value from input using JSONPath
 *
 * @param {string} path - JSONPath expression
 * @param {object} input - Input data
 * @returns {any} Value at path
 */
function getVariableValue(path, input) {
  if (!path || !path.startsWith('$.')) {
    return path;
  }

  // Simple JSONPath implementation
  const parts = path.slice(2).split('.');
  let value = input;

  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined;
    }

    // Handle array indexing like items[0]
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      value = value[match[1]];
      if (Array.isArray(value)) {
        value = value[parseInt(match[2], 10)];
      }
    } else {
      value = value[part];
    }
  }

  return value;
}

/**
 * Match string against pattern (supports * wildcard)
 *
 * @param {string} value - Value to test
 * @param {string} pattern - Pattern with * wildcards
 * @returns {boolean} True if matches
 */
function matchPattern(value, pattern) {
  if (typeof value !== 'string') {
    return false;
  }

  // Convert pattern to regex
  const regex = new RegExp(
    '^' + pattern.split('*').map(escapeRegex).join('.*') + '$'
  );
  return regex.test(value);
}

/**
 * Escape special regex characters
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Handle Input state (human-in-the-loop interaction) - NON-BLOCKING
 *
 * Input states pause workflow execution to collect user input.
 * Supports: SingleSelect, MultiSelect, Boolean, Text, Number, Date, Form, Confirm, Table
 *
 * This function creates the callback and returns immediately without waiting.
 * The caller is responsible for pausing execution and resuming later.
 *
 * @param {object} state - ASL Input state definition
 * @param {object} input - Current workflow data
 * @param {object} callbackHandler - Callback handler instance
 * @param {object} executionContext - Current execution context
 * @returns {Promise<object>} Callback info { callbackId, inputRequest }
 */
export async function handleInputState(state, input, callbackHandler, executionContext) {
  if (!callbackHandler) {
    throw new TaskError(
      'CallbackHandlerNotConfigured',
      'Callback handler is not configured for Input state'
    );
  }

  // Resolve dynamic options using JSONPath if specified
  const resolvedState = resolveInputStateOptions(state, input);

  // Build input request for the callback
  const inputRequest = {
    inputType: resolvedState.InputType,
    title: resolvedState.Title,
    description: resolvedState.Description,
    required: resolvedState.Required ?? true,
    timeout: resolvedState.Timeout ?? 3600,
    default: resolvedState.Default
  };

  // Add type-specific fields
  switch (resolvedState.InputType) {
    case 'SingleSelect':
    case 'MultiSelect':
      inputRequest.options = resolvedState.Options;
      inputRequest.optionLabel = resolvedState.OptionLabel;
      inputRequest.optionValue = resolvedState.OptionValue;
      inputRequest.optionDescription = resolvedState.OptionDescription;
      if (resolvedState.InputType === 'MultiSelect') {
        inputRequest.minSelections = resolvedState.MinSelections;
        inputRequest.maxSelections = resolvedState.MaxSelections;
      }
      break;

    case 'Boolean':
      inputRequest.trueLabel = resolvedState.TrueLabel;
      inputRequest.falseLabel = resolvedState.FalseLabel;
      break;

    case 'Text':
      inputRequest.minLength = resolvedState.MinLength;
      inputRequest.maxLength = resolvedState.MaxLength;
      inputRequest.pattern = resolvedState.Pattern;
      inputRequest.patternError = resolvedState.PatternError;
      inputRequest.multiline = resolvedState.Multiline;
      inputRequest.placeholder = resolvedState.Placeholder;
      break;

    case 'JSON':
      inputRequest.maxLength = resolvedState.MaxLength;
      inputRequest.pretty = resolvedState.Pretty;
      inputRequest.validateSchema = resolvedState.ValidateSchema;
      // Schema path for AI to read and understand expected JSON format
      if (resolvedState.SchemaPath) {
        inputRequest.schemaPath = resolvedState.SchemaPath;
      }
      if (resolvedState.SchemaUrl) {
        inputRequest.schemaUrl = resolvedState.SchemaUrl;
      }
      break;

    case 'Number':
      inputRequest.min = resolvedState.Min;
      inputRequest.max = resolvedState.Max;
      inputRequest.step = resolvedState.Step;
      inputRequest.decimalPlaces = resolvedState.DecimalPlaces;
      inputRequest.unit = resolvedState.Unit;
      break;

    case 'Date':
      inputRequest.minDate = resolvedState.MinDate;
      inputRequest.maxDate = resolvedState.MaxDate;
      inputRequest.includeTime = resolvedState.IncludeTime;
      inputRequest.format = resolvedState.Format;
      break;

    case 'Form':
      inputRequest.fields = resolvedState.Fields;
      inputRequest.layout = resolvedState.Layout;
      break;

    case 'Confirm':
      inputRequest.details = resolvedState.Details;
      inputRequest.detailFields = resolvedState.DetailFields;
      inputRequest.confirmLabel = resolvedState.ConfirmLabel;
      inputRequest.cancelLabel = resolvedState.CancelLabel;
      inputRequest.warningLevel = resolvedState.WarningLevel;
      inputRequest.warningMessage = resolvedState.WarningMessage;
      inputRequest.requireTypedConfirmation = resolvedState.RequireTypedConfirmation;
      inputRequest.confirmationPhrase = resolvedState.ConfirmationPhrase;
      break;

    case 'Table':
      inputRequest.data = resolvedState.Data;
      inputRequest.columns = resolvedState.Columns;
      inputRequest.selectable = resolvedState.Selectable;
      inputRequest.multiSelect = resolvedState.MultiSelect;
      inputRequest.minSelections = resolvedState.MinSelections;
      inputRequest.maxSelections = resolvedState.MaxSelections;
      inputRequest.sortable = resolvedState.Sortable;
      inputRequest.filterable = resolvedState.Filterable;
      inputRequest.returnType = resolvedState.ReturnType ?? 'row';
      break;
  }

  // Create callback with input request (non-blocking)
  const callback = await callbackHandler.createCallback(
    executionContext.executionId,
    executionContext.stateName,
    `Input: ${resolvedState.Title}`,
    {
      inputType: resolvedState.InputType,
      inputRequest,
      timeoutSeconds: resolvedState.Timeout ?? 3600,
      channels: ['console']
    }
  );

  // Return callback info immediately (don't wait)
  return {
    callbackId: callback.id,
    inputRequest
  };
}

/**
 * Process callback response for Input state
 *
 * @param {object} response - Callback response
 * @returns {any} User's input value
 */
export function processInputResponse(response) {
  // Handle rejection (user cancelled)
  if (response.approved === false) {
    throw new TaskError(
      'InputCancelled',
      'User cancelled the input request'
    );
  }

  // Return the user's input value
  return response.data !== undefined ? response.data : response;
}

/**
 * Resolve dynamic options in Input state using JSONPath
 *
 * @param {object} state - Input state definition
 * @param {object} input - Current workflow data
 * @returns {object} State with resolved options
 */
function resolveInputStateOptions(state, input) {
  const resolved = { ...state };

  // Resolve Options.$ -> Options
  if (state['Options.$']) {
    resolved.Options = getVariableValue(state['Options.$'], input);
    delete resolved['Options.$'];
  }

  // Resolve Data.$ -> Data (for Table)
  if (state['Data.$']) {
    resolved.Data = getVariableValue(state['Data.$'], input);
    delete resolved['Data.$'];
  }

  // Resolve Details.$ -> Details (for Confirm)
  if (state['Details.$']) {
    resolved.Details = getVariableValue(state['Details.$'], input);
    delete resolved['Details.$'];
  }

  // Resolve MinDate.$ and MaxDate.$
  if (state['MinDate.$']) {
    resolved.MinDate = getVariableValue(state['MinDate.$'], input);
    delete resolved['MinDate.$'];
  }
  if (state['MaxDate.$']) {
    resolved.MaxDate = getVariableValue(state['MaxDate.$'], input);
    delete resolved['MaxDate.$'];
  }

  // Resolve SchemaPath.$ -> SchemaPath (for Text inputs with JSON schema reference)
  if (state['SchemaPath.$']) {
    resolved.SchemaPath = getVariableValue(state['SchemaPath.$'], input);
    delete resolved['SchemaPath.$'];
  }

  return resolved;
}

/**
 * Task execution error
 */
export class TaskError extends Error {
  constructor(error, cause, details = {}) {
    super(cause);
    this.name = 'TaskError';
    this.error = error;
    this.cause = cause;
    this.details = details;
  }
}
