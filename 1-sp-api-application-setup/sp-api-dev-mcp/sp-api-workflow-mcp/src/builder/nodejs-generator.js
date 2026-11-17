/**
 * Node.js Console App Generator
 *
 * Converts ASL workflows to standalone Node.js console applications.
 * Generated apps include embedded SP-API client, JSONPath utilities,
 * and workflow executor with readline-based human interaction.
 */

/**
 * Generate a Node.js console app from a workflow schema
 *
 * @param {object} schema - ASL workflow schema
 * @param {object} options - Generation options
 * @param {string} options.workflowName - Name for the workflow
 * @returns {string} Generated Node.js code
 */
export function generateNodejsApp(schema, options = {}) {
  const workflowName = options.workflowName || 'workflow';
  const workflowJson = JSON.stringify(schema, null, 2);

  return `#!/usr/bin/env node
/**
 * Generated Workflow: ${workflowName}
 * Generated at: ${new Date().toISOString()}
 *
 * This is a standalone Node.js console application that executes
 * the workflow defined below. Run with: node ${workflowName}.js
 *
 * Required environment variables for SP-API calls:
 *   SP_API_CLIENT_ID
 *   SP_API_CLIENT_SECRET
 *   SP_API_REFRESH_TOKEN
 *   SP_API_REGION (optional, defaults to 'na')
 */

import * as readline from 'readline';

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

const WORKFLOW = ${workflowJson};

// ============================================================================
// SP-API CLIENT
// ============================================================================

class TokenManager {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.refreshToken = config.refreshToken;
    this.accessToken = null;
    this.expiresAt = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.expiresAt && Date.now() < this.expiresAt - 60000) {
      return this.accessToken;
    }

    const response = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(\`Token refresh failed: \${error}\`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + (data.expires_in * 1000);
    return this.accessToken;
  }
}

class SPAPIClient {
  constructor(config) {
    this.tokenManager = new TokenManager(config);
    this.baseUrl = this.getRegionalEndpoint(config.region || 'na');
    this.timeout = config.timeout || 30000;
  }

  getRegionalEndpoint(region) {
    const endpoints = {
      na: 'https://sellingpartnerapi-na.amazon.com',
      eu: 'https://sellingpartnerapi-eu.amazon.com',
      fe: 'https://sellingpartnerapi-fe.amazon.com'
    };
    return endpoints[region] || endpoints.na;
  }

  async execute(spec) {
    const { method = 'GET', path, pathParams = {}, queryParams = {}, body, headers = {} } = spec;

    if (!path) {
      throw new Error('Missing required "path" in request specification');
    }

    const accessToken = await this.tokenManager.getAccessToken();
    const url = this.buildUrl(path, pathParams, queryParams);

    const options = {
      method: method.toUpperCase(),
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      options.body = JSON.stringify(body);
    }

    console.log(\`\\n[SP-API] \${options.method} \${url}\`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      if (!response.ok) {
        const errorBody = isJson ? await response.json() : await response.text();
        const error = new Error(\`SP-API error: \${response.status}\`);
        error.status = response.status;
        error.body = errorBody;
        throw error;
      }

      if (response.status === 204) return {};
      return isJson ? response.json() : { text: await response.text() };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  buildUrl(path, pathParams, queryParams) {
    let resolvedPath = path;
    for (const [key, value] of Object.entries(pathParams)) {
      resolvedPath = resolvedPath.replace(\`{\${key}}\`, encodeURIComponent(value));
    }

    const queryParts = [];
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          queryParts.push(\`\${encodeURIComponent(key)}=\${value.map(v => encodeURIComponent(v)).join(',')}\`);
        } else {
          queryParts.push(\`\${encodeURIComponent(key)}=\${encodeURIComponent(value)}\`);
        }
      }
    }

    const queryString = queryParts.length > 0 ? \`?\${queryParts.join('&')}\` : '';
    return \`\${this.baseUrl}\${resolvedPath}\${queryString}\`;
  }
}

// ============================================================================
// JSONPATH UTILITIES
// ============================================================================

function getByPath(obj, path) {
  if (!path || path === '') return obj;
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const arrayMatch = part.match(/^(\\w+)\\[(\\d+)\\]$/);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      current = current[key]?.[parseInt(indexStr, 10)];
    } else {
      current = current[part];
    }
  }
  return current;
}

function evaluateJsonPath(path, input, context = {}) {
  if (typeof path !== 'string') return path;

  if (path.startsWith('States.')) {
    return evaluateIntrinsicFunction(path, input, context);
  }

  if (path.startsWith('$$')) {
    const contextPath = path.slice(2);
    return contextPath.startsWith('.') ? getByPath(context, contextPath.slice(1)) : context;
  }

  if (path.startsWith('$')) {
    const inputPath = path.slice(1);
    return inputPath.startsWith('.') ? getByPath(input, inputPath.slice(1)) : input;
  }

  return path;
}

function evaluateIntrinsicFunction(expr, input, context = {}) {
  const match = expr.match(/^States\\.(\\w+)\\((.*)\\)$/s);
  if (!match) throw new Error(\`Invalid intrinsic function: \${expr}\`);

  const [, funcName, argsString] = match;
  const args = parseIntrinsicArgs(argsString, input, context);

  switch (funcName) {
    case 'Array': return args;
    case 'Format': {
      let template = args[0];
      let argIndex = 1;
      return template.replace(/\\{\\}/g, () => {
        if (argIndex < args.length) {
          const val = args[argIndex++];
          return typeof val === 'object' ? JSON.stringify(val) : String(val);
        }
        return '{}';
      });
    }
    case 'StringToJson': return JSON.parse(args[0]);
    case 'JsonToString': return JSON.stringify(args[0]);
    case 'ArrayLength': return args[0].length;
    case 'ArrayGetItem': return args[0][args[1]];
    case 'ArrayContains': return args[0].includes(args[1]);
    case 'ArrayUnique': return [...new Set(args[0])];
    case 'MathAdd': return args[0] + args[1];
    case 'StringSplit': return args[0].split(args[1]);
    case 'UUID': return crypto.randomUUID();
    default: throw new Error(\`Unknown intrinsic: States.\${funcName}\`);
  }
}

function parseIntrinsicArgs(argsString, input, context) {
  const args = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let depth = 0;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];
    if (inString) {
      current += char;
      if (char === stringChar && argsString[i - 1] !== '\\\\') inString = false;
    } else if (char === "'" || char === '"') {
      inString = true;
      stringChar = char;
      current += char;
    } else if (char === '(') { depth++; current += char; }
    else if (char === ')') { depth--; current += char; }
    else if (char === ',' && depth === 0) {
      if (current.trim()) args.push(resolveIntrinsicArg(current.trim(), input, context));
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) args.push(resolveIntrinsicArg(current.trim(), input, context));
  return args;
}

function resolveIntrinsicArg(arg, input, context) {
  if ((arg.startsWith("'") && arg.endsWith("'")) || (arg.startsWith('"') && arg.endsWith('"'))) {
    return arg.slice(1, -1);
  }
  if (/^-?\\d+(\\.\\d+)?$/.test(arg)) return parseFloat(arg);
  if (arg === 'true') return true;
  if (arg === 'false') return false;
  if (arg === 'null') return null;
  if (arg.startsWith('States.')) return evaluateIntrinsicFunction(arg, input, context);
  if (arg.startsWith('$')) return evaluateJsonPath(arg, input, context);
  return arg;
}

function resolveParameters(template, input, context = {}) {
  if (template === null || template === undefined) return template;

  if (typeof template === 'object' && !Array.isArray(template)) {
    const resolved = {};
    for (const [key, value] of Object.entries(template)) {
      if (key.endsWith('.$')) {
        resolved[key.slice(0, -2)] = evaluateJsonPath(value, input, context);
      } else {
        resolved[key] = resolveParameters(value, input, context);
      }
    }
    return resolved;
  }

  if (Array.isArray(template)) {
    return template.map(item => resolveParameters(item, input, context));
  }

  if (typeof template === 'string' && template.startsWith('$')) {
    return evaluateJsonPath(template, input, context);
  }

  return template;
}

function setByPath(obj, path, value) {
  if (!path || path === '$') return value;
  let cleanPath = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path;

  const result = { ...obj };
  const parts = cleanPath.split('.');
  let current = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    } else {
      current[part] = { ...current[part] };
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

function applyInputPath(input, inputPath) {
  if (inputPath === null || inputPath === undefined || inputPath === '$') return input;
  return evaluateJsonPath(inputPath, input);
}

function applyResultPath(input, result, resultPath) {
  if (resultPath === null) return input;
  if (resultPath === undefined || resultPath === '$') return result;
  return setByPath(input, resultPath, result);
}

function applyOutputPath(output, outputPath) {
  if (outputPath === null) return {};
  if (outputPath === undefined || outputPath === '$') return output;
  return evaluateJsonPath(outputPath, output);
}

// ============================================================================
// CHOICE STATE EVALUATION
// ============================================================================

function evaluateChoiceState(state, input) {
  const choices = state.Choices || [];
  for (const choice of choices) {
    if (evaluateChoiceRule(choice, input)) return choice.Next;
  }
  return state.Default || null;
}

function evaluateChoiceRule(rule, input) {
  const variable = evaluateJsonPath(rule.Variable, input);

  // String comparisons
  if (rule.StringEquals !== undefined) return variable === rule.StringEquals;
  if (rule.StringEqualsPath !== undefined) return variable === evaluateJsonPath(rule.StringEqualsPath, input);
  if (rule.StringLessThan !== undefined) return variable < rule.StringLessThan;
  if (rule.StringGreaterThan !== undefined) return variable > rule.StringGreaterThan;

  // Numeric comparisons
  if (rule.NumericEquals !== undefined) return variable === rule.NumericEquals;
  if (rule.NumericEqualsPath !== undefined) return variable === evaluateJsonPath(rule.NumericEqualsPath, input);
  if (rule.NumericLessThan !== undefined) return variable < rule.NumericLessThan;
  if (rule.NumericLessThanPath !== undefined) return variable < evaluateJsonPath(rule.NumericLessThanPath, input);
  if (rule.NumericGreaterThan !== undefined) return variable > rule.NumericGreaterThan;
  if (rule.NumericGreaterThanPath !== undefined) return variable > evaluateJsonPath(rule.NumericGreaterThanPath, input);
  if (rule.NumericLessThanEquals !== undefined) return variable <= rule.NumericLessThanEquals;
  if (rule.NumericGreaterThanEquals !== undefined) return variable >= rule.NumericGreaterThanEquals;

  // Boolean comparisons
  if (rule.BooleanEquals !== undefined) return variable === rule.BooleanEquals;

  // Type checks
  if (rule.IsNull !== undefined) return (variable === null) === rule.IsNull;
  if (rule.IsPresent !== undefined) return (variable !== undefined) === rule.IsPresent;
  if (rule.IsNumeric !== undefined) return (typeof variable === 'number') === rule.IsNumeric;
  if (rule.IsString !== undefined) return (typeof variable === 'string') === rule.IsString;
  if (rule.IsBoolean !== undefined) return (typeof variable === 'boolean') === rule.IsBoolean;

  // Logical operators
  if (rule.Not !== undefined) return !evaluateChoiceRule(rule.Not, input);
  if (rule.And !== undefined) return rule.And.every(r => evaluateChoiceRule(r, input));
  if (rule.Or !== undefined) return rule.Or.some(r => evaluateChoiceRule(r, input));

  return false;
}

// ============================================================================
// HUMAN INPUT (READLINE)
// ============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function handleInputState(state, input) {
  console.log('\\n' + '='.repeat(60));
  console.log(\`INPUT REQUIRED: \${state.Title}\`);
  if (state.Description) console.log(state.Description);
  console.log('='.repeat(60));

  const inputType = state.InputType;

  switch (inputType) {
    case 'Text': {
      const answer = await prompt('Enter text: ');
      return answer;
    }

    case 'Number': {
      const answer = await prompt(\`Enter number\${state.Min !== undefined ? \` (min: \${state.Min})\` : ''}\${state.Max !== undefined ? \` (max: \${state.Max})\` : ''}: \`);
      return parseFloat(answer);
    }

    case 'Boolean': {
      const trueLabel = state.TrueLabel || 'Yes';
      const falseLabel = state.FalseLabel || 'No';
      const answer = await prompt(\`\${trueLabel}/\${falseLabel} (y/n): \`);
      return answer.toLowerCase().startsWith('y');
    }

    case 'SingleSelect': {
      const options = resolveOptions(state, input);
      console.log('\\nOptions:');
      options.forEach((opt, i) => {
        const label = state.OptionLabel ? opt[state.OptionLabel] : opt;
        const desc = state.OptionDescription ? opt[state.OptionDescription] : '';
        console.log(\`  \${i + 1}. \${label}\${desc ? \` - \${desc}\` : ''}\`);
      });
      const answer = await prompt('\\nSelect option number: ');
      const index = parseInt(answer, 10) - 1;
      const selected = options[index];
      return state.OptionValue ? selected[state.OptionValue] : selected;
    }

    case 'MultiSelect': {
      const options = resolveOptions(state, input);
      console.log('\\nOptions:');
      options.forEach((opt, i) => {
        const label = state.OptionLabel ? opt[state.OptionLabel] : opt;
        console.log(\`  \${i + 1}. \${label}\`);
      });
      const answer = await prompt('\\nSelect option numbers (comma-separated): ');
      const indices = answer.split(',').map(s => parseInt(s.trim(), 10) - 1);
      return indices.map(i => {
        const selected = options[i];
        return state.OptionValue ? selected[state.OptionValue] : selected;
      });
    }

    case 'Date': {
      const answer = await prompt('Enter date (YYYY-MM-DD): ');
      return answer;
    }

    case 'Confirm': {
      if (state.Details) {
        console.log('\\nDetails:');
        if (state.DetailFields) {
          const details = state['Details.$'] ? evaluateJsonPath(state['Details.$'], input) : state.Details;
          for (const field of state.DetailFields) {
            console.log(\`  \${field.label || field.key}: \${details[field.key]}\`);
          }
        } else {
          console.log(JSON.stringify(state.Details, null, 2));
        }
      }
      if (state.WarningMessage) {
        console.log(\`\\n⚠️  WARNING: \${state.WarningMessage}\`);
      }
      const confirmLabel = state.ConfirmLabel || 'Confirm';
      const cancelLabel = state.CancelLabel || 'Cancel';
      const answer = await prompt(\`\\n\${confirmLabel}/\${cancelLabel} (y/n): \`);
      if (!answer.toLowerCase().startsWith('y')) {
        throw new Error('User cancelled');
      }
      return true;
    }

    case 'Form': {
      const result = {};
      for (const field of state.Fields || []) {
        const label = field.Label || field.label || field.Name || field.name;
        const name = field.Name || field.name;
        const required = field.Required !== undefined ? field.Required : field.required;
        const type = field.Type || field.type;
        const fieldPrompt = \`\${label}\${required ? ' *' : ''}: \`;
        const answer = await prompt(fieldPrompt);
        if (type === 'number') {
          result[name] = parseFloat(answer);
        } else if (type === 'boolean') {
          result[name] = answer.toLowerCase().startsWith('y');
        } else {
          result[name] = answer;
        }
      }
      return result;
    }

    case 'Table': {
      const data = state['Data.$'] ? evaluateJsonPath(state['Data.$'], input) : state.Data || [];
      const columns = state.Columns || [];

      console.log('\\n' + columns.map(c => (c.header || c.field).padEnd(20)).join(' | '));
      console.log('-'.repeat(columns.length * 23));
      data.forEach((row, i) => {
        const rowData = columns.map(c => String(row[c.field] || '').padEnd(20)).join(' | ');
        console.log(\`\${String(i + 1).padStart(3)}. \${rowData}\`);
      });

      if (state.Selectable !== false) {
        if (state.MultiSelect) {
          const answer = await prompt('\\nSelect row numbers (comma-separated): ');
          const indices = answer.split(',').map(s => parseInt(s.trim(), 10) - 1);
          return indices.map(i => data[i]);
        } else {
          const answer = await prompt('\\nSelect row number: ');
          return data[parseInt(answer, 10) - 1];
        }
      }
      return data;
    }

    default:
      const answer = await prompt('Enter value: ');
      return answer;
  }
}

function resolveOptions(state, input) {
  if (state['Options.$']) {
    return evaluateJsonPath(state['Options.$'], input);
  }
  return state.Options || [];
}

// ============================================================================
// WORKFLOW EXECUTOR
// ============================================================================

class WorkflowExecutor {
  constructor(spApiClient) {
    this.spApiClient = spApiClient;
  }

  async execute(schema, input = {}) {
    let currentState = schema.StartAt;
    let currentData = input;

    console.log(\`\\n>>> Starting workflow at: \${currentState}\`);

    while (currentState) {
      const state = schema.States[currentState];
      if (!state) throw new Error(\`State not found: \${currentState}\`);

      console.log(\`\\n>>> Executing state: \${currentState} (Type: \${state.Type})\`);

      try {
        const { output, nextState } = await this.executeState(currentState, state, currentData);
        currentData = output;
        currentState = nextState;
      } catch (error) {
        // Try catch handler
        const catchResult = this.handleCatch(state, error, currentData);
        if (catchResult) {
          currentData = catchResult.output;
          currentState = catchResult.nextState;
        } else {
          throw error;
        }
      }
    }

    console.log('\\n>>> Workflow completed successfully!');
    return currentData;
  }

  async executeState(stateName, state, input) {
    let effectiveInput = applyInputPath(input, state.InputPath);
    let result;

    switch (state.Type) {
      case 'Task':
        result = await this.executeTaskState(state, effectiveInput);
        break;

      case 'Pass':
        if (state.Parameters !== undefined) {
          result = resolveParameters(state.Parameters, effectiveInput);
        } else if (state.Result !== undefined) {
          result = state.Result;
        } else {
          result = effectiveInput;
        }
        break;

      case 'Wait':
        const seconds = state.Seconds || 1;
        console.log(\`    Waiting \${seconds} seconds...\`);
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        result = effectiveInput;
        break;

      case 'Choice':
        const nextState = evaluateChoiceState(state, effectiveInput);
        if (!nextState) throw new Error('No choice matched and no Default specified');
        return { output: effectiveInput, nextState };

      case 'Succeed':
        console.log('    State succeeded');
        return { output: effectiveInput, nextState: null };

      case 'Fail':
        throw { error: state.Error || 'StateFailed', cause: state.Cause || 'State failed' };

      case 'Input':
        result = await handleInputState(state, effectiveInput);
        break;

      case 'Parallel':
        const branches = state.Branches || [];
        result = [];
        for (const branch of branches) {
          const branchResult = await this.execute(branch, effectiveInput);
          result.push(branchResult);
        }
        break;

      case 'Map':
        let items = state.ItemsPath ? evaluateJsonPath(state.ItemsPath, effectiveInput) : effectiveInput;
        if (!Array.isArray(items)) items = [items];
        const processor = state.ItemProcessor || state.Iterator;
        result = [];
        for (const item of items) {
          const itemResult = await this.execute(processor, item);
          result.push(itemResult);
        }
        break;

      default:
        throw new Error(\`Unknown state type: \${state.Type}\`);
    }

    const outputWithResult = applyResultPath(input, result, state.ResultPath);
    const finalOutput = applyOutputPath(outputWithResult, state.OutputPath);
    const nextState = state.End ? null : state.Next;

    return { output: finalOutput, nextState };
  }

  async executeTaskState(state, input) {
    const parameters = state.Parameters ? resolveParameters(state.Parameters, input) : input;
    const resource = state.Resource;

    if (resource === 'sp-api' || !resource) {
      if (!this.spApiClient) {
        throw new Error('SP-API client not configured. Set environment variables.');
      }
      return this.executeWithRetry(() => this.spApiClient.execute(parameters), state.Retry);
    }

    if (resource === 'fetch') {
      return this.executeWithRetry(() => this.executeFetch(parameters), state.Retry);
    }

    throw new Error(\`Unknown resource: \${resource}\`);
  }

  async executeFetch(params) {
    const { url, responseType = 'json', decompress = false, headers = {}, timeout = 30 } = params;
    if (!url) throw new Error('Fetch task requires "url" in Parameters');

    console.log(\`    Fetching: \${url.substring(0, 80)}...\`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': responseType === 'json' ? 'application/json' : '*/*',
          ...headers
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(\`Fetch failed: \${response.status} \${response.statusText}\`);
      }

      if (responseType === 'json') {
        return response.json();
      } else if (responseType === 'base64') {
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
      } else {
        return response.text();
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async executeWithRetry(fn, retryConfig) {
    if (!retryConfig || retryConfig.length === 0) return fn();

    let lastError;
    for (const retry of retryConfig) {
      const maxAttempts = retry.MaxAttempts ?? 3;
      const intervalSeconds = retry.IntervalSeconds || 1;
      const backoffRate = retry.BackoffRate || 2.0;

      for (let attempt = 0; attempt <= maxAttempts; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;
          if (attempt >= maxAttempts) break;
          const delay = intervalSeconds * Math.pow(backoffRate, attempt) * 1000;
          console.log(\`    Retry attempt \${attempt + 1}/\${maxAttempts} in \${delay}ms...\`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  handleCatch(state, error, input) {
    if (!state.Catch || state.Catch.length === 0) return null;

    const errorName = error.error || error.name || 'Error';
    for (const catcher of state.Catch) {
      const errorEquals = catcher.ErrorEquals || [];
      const matches = errorEquals.includes('States.ALL') ||
                     errorEquals.includes(errorName) ||
                     errorEquals.includes('States.TaskFailed');

      if (matches) {
        const errorOutput = { Error: errorName, Cause: error.cause || error.message };
        const output = applyResultPath(input, errorOutput, catcher.ResultPath);
        return { output, nextState: catcher.Next };
      }
    }
    return null;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Workflow Executor: ${workflowName}');
  console.log('='.repeat(60));

  // Initialize SP-API client from environment
  let spApiClient = null;
  const clientId = process.env.SP_API_CLIENT_ID;
  const clientSecret = process.env.SP_API_CLIENT_SECRET;
  const refreshToken = process.env.SP_API_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    spApiClient = new SPAPIClient({
      clientId,
      clientSecret,
      refreshToken,
      region: process.env.SP_API_REGION || 'na'
    });
    console.log('SP-API client initialized');
  } else {
    console.log('SP-API credentials not set (SP_API_CLIENT_ID, SP_API_CLIENT_SECRET, SP_API_REFRESH_TOKEN)');
    console.log('Task states requiring SP-API will fail');
  }

  const executor = new WorkflowExecutor(spApiClient);

  try {
    // Get initial input from command line or use empty object
    let initialInput = {};
    if (process.argv[2]) {
      try {
        initialInput = JSON.parse(process.argv[2]);
      } catch (e) {
        console.log('Note: Could not parse command line argument as JSON, using empty input');
      }
    }

    const result = await executor.execute(WORKFLOW, initialInput);

    console.log('\\n' + '='.repeat(60));
    console.log('WORKFLOW OUTPUT:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\\n' + '='.repeat(60));
    console.error('WORKFLOW FAILED:');
    console.error('='.repeat(60));
    console.error('Error:', error.error || error.name || 'Unknown');
    console.error('Cause:', error.cause || error.message);
    if (error.body) console.error('Details:', JSON.stringify(error.body, null, 2));
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
`;
}
