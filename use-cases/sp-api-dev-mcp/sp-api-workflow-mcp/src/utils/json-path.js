/**
 * JSONPath resolution utilities for ASL parameter processing
 * Supports basic JSONPath expressions used in Amazon States Language
 */

/**
 * Get value from object using dot-notation path
 * Supports array index notation: items[0], nested.items[2].name
 *
 * @param {object} obj - Source object
 * @param {string} path - Dot-notation path (without leading $)
 * @returns {any} Value at path or undefined
 */
export function getByPath(obj, path) {
  if (!path || path === '') {
    return obj;
  }

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle array index notation: items[0]
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);
      current = current[key]?.[index];
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Evaluate a JSONPath expression against input and context
 * Also handles ASL intrinsic functions like States.Array(), States.Format(), etc.
 *
 * @param {string} path - JSONPath expression (e.g., "$.foo.bar" or "$$.Execution.Id") or intrinsic function
 * @param {object} input - Current state input
 * @param {object} context - Execution context (for $$ references)
 * @returns {any} Resolved value
 */
export function evaluateJsonPath(path, input, context = {}) {
  if (typeof path !== 'string') {
    return path;
  }

  // Handle intrinsic functions (States.X(...))
  if (path.startsWith('States.')) {
    return evaluateIntrinsicFunction(path, input, context);
  }

  // $$ refers to context object (execution metadata)
  if (path.startsWith('$$')) {
    const contextPath = path.slice(2); // Remove $$
    if (contextPath.startsWith('.')) {
      return getByPath(context, contextPath.slice(1));
    }
    return context;
  }

  // $ refers to input
  if (path.startsWith('$')) {
    const inputPath = path.slice(1); // Remove $
    if (inputPath.startsWith('.')) {
      return getByPath(input, inputPath.slice(1));
    }
    return input;
  }

  // Not a JSONPath, return as-is
  return path;
}

/**
 * Evaluate an ASL intrinsic function
 * Supports: States.Array, States.Format, States.StringToJson, States.JsonToString,
 *           States.ArrayPartition, States.ArrayContains, States.ArrayRange,
 *           States.ArrayGetItem, States.ArrayLength, States.ArrayUnique,
 *           States.MathAdd, States.MathRandom, States.StringSplit, States.UUID
 *
 * @param {string} expr - Intrinsic function expression (e.g., "States.Array($.a, $.b)")
 * @param {object} input - Current state input
 * @param {object} context - Execution context
 * @returns {any} Evaluated result
 */
export function evaluateIntrinsicFunction(expr, input, context = {}) {
  // Parse function name and arguments
  const match = expr.match(/^States\.(\w+)\((.*)\)$/s);
  if (!match) {
    throw new Error(`Invalid intrinsic function syntax: ${expr}`);
  }

  const [, funcName, argsString] = match;
  const args = parseIntrinsicArgs(argsString, input, context);

  switch (funcName) {
    case 'Array':
      // States.Array(val1, val2, ...) - wraps arguments into an array
      return args;

    case 'Format':
      // States.Format('template {}', arg1, arg2) - string formatting
      if (args.length < 1) {
        throw new Error('States.Format requires at least a template string');
      }
      let template = args[0];
      let argIndex = 1;
      return template.replace(/\{\}/g, () => {
        if (argIndex < args.length) {
          const val = args[argIndex++];
          return typeof val === 'object' ? JSON.stringify(val) : String(val);
        }
        return '{}';
      });

    case 'StringToJson':
      // States.StringToJson(jsonString) - parse JSON string
      if (args.length !== 1) {
        throw new Error('States.StringToJson requires exactly one argument');
      }
      // If already an object, return as-is (handles case where input is already parsed)
      if (typeof args[0] === 'object' && args[0] !== null) {
        return args[0];
      }
      return JSON.parse(args[0]);

    case 'JsonToString':
      // States.JsonToString(object) - stringify to JSON
      if (args.length !== 1) {
        throw new Error('States.JsonToString requires exactly one argument');
      }
      return JSON.stringify(args[0]);

    case 'ArrayPartition':
      // States.ArrayPartition(array, chunkSize) - split array into chunks
      if (args.length !== 2) {
        throw new Error('States.ArrayPartition requires exactly two arguments');
      }
      const arr = args[0];
      const size = args[1];
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;

    case 'ArrayContains':
      // States.ArrayContains(array, value) - check if array contains value
      if (args.length !== 2) {
        throw new Error('States.ArrayContains requires exactly two arguments');
      }
      return args[0].includes(args[1]);

    case 'ArrayRange':
      // States.ArrayRange(start, end, step) - generate number array
      if (args.length !== 3) {
        throw new Error('States.ArrayRange requires exactly three arguments');
      }
      const [start, end, step] = args;
      const range = [];
      for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
        range.push(i);
      }
      return range;

    case 'ArrayGetItem':
      // States.ArrayGetItem(array, index) - get item at index
      if (args.length !== 2) {
        throw new Error('States.ArrayGetItem requires exactly two arguments');
      }
      return args[0][args[1]];

    case 'ArrayLength':
      // States.ArrayLength(array) - get array length
      if (args.length !== 1) {
        throw new Error('States.ArrayLength requires exactly one argument');
      }
      return args[0].length;

    case 'ArrayUnique':
      // States.ArrayUnique(array) - remove duplicates
      if (args.length !== 1) {
        throw new Error('States.ArrayUnique requires exactly one argument');
      }
      return [...new Set(args[0])];

    case 'MathAdd':
      // States.MathAdd(num1, num2) - add two numbers
      if (args.length !== 2) {
        throw new Error('States.MathAdd requires exactly two arguments');
      }
      return args[0] + args[1];

    case 'MathRandom':
      // States.MathRandom(start, end) - random number in range
      if (args.length !== 2) {
        throw new Error('States.MathRandom requires exactly two arguments');
      }
      return Math.floor(Math.random() * (args[1] - args[0] + 1)) + args[0];

    case 'StringSplit':
      // States.StringSplit(string, delimiter) - split string
      if (args.length !== 2) {
        throw new Error('States.StringSplit requires exactly two arguments');
      }
      return args[0].split(args[1]);

    case 'UUID':
      // States.UUID() - generate UUID
      return crypto.randomUUID ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

    default:
      throw new Error(`Unknown intrinsic function: States.${funcName}`);
  }
}

/**
 * Parse arguments from intrinsic function call
 * Handles JSONPath references, string literals, numbers, booleans, and nested functions
 *
 * @param {string} argsString - Arguments string (e.g., "$.a, 'literal', 42")
 * @param {object} input - Current state input
 * @param {object} context - Execution context
 * @returns {Array} Resolved argument values
 */
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
      if (char === stringChar && argsString[i - 1] !== '\\') {
        inString = false;
      }
    } else if (char === "'" || char === '"') {
      inString = true;
      stringChar = char;
      current += char;
    } else if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) {
        args.push(resolveIntrinsicArg(trimmed, input, context));
      }
      current = '';
    } else {
      current += char;
    }
  }

  const trimmed = current.trim();
  if (trimmed) {
    args.push(resolveIntrinsicArg(trimmed, input, context));
  }

  return args;
}

/**
 * Resolve a single intrinsic function argument
 *
 * @param {string} arg - Argument string
 * @param {object} input - Current state input
 * @param {object} context - Execution context
 * @returns {any} Resolved value
 */
function resolveIntrinsicArg(arg, input, context) {
  // String literal
  if ((arg.startsWith("'") && arg.endsWith("'")) || (arg.startsWith('"') && arg.endsWith('"'))) {
    return arg.slice(1, -1);
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(arg)) {
    return parseFloat(arg);
  }

  // Boolean
  if (arg === 'true') return true;
  if (arg === 'false') return false;

  // Null
  if (arg === 'null') return null;

  // Nested intrinsic function
  if (arg.startsWith('States.')) {
    return evaluateIntrinsicFunction(arg, input, context);
  }

  // JSONPath
  if (arg.startsWith('$')) {
    return evaluateJsonPath(arg, input, context);
  }

  // Unknown - return as string
  return arg;
}

/**
 * Resolve parameter templates with JSONPath substitution
 * Keys ending with .$ are treated as JSONPath references
 *
 * @param {any} template - Parameter template (object, array, or primitive)
 * @param {object} input - Current state input
 * @param {object} context - Execution context
 * @returns {any} Resolved parameters
 */
export function resolveParameters(template, input, context = {}) {
  if (template === null || template === undefined) {
    return template;
  }

  // Handle objects
  if (typeof template === 'object' && !Array.isArray(template)) {
    const resolved = {};

    for (const [key, value] of Object.entries(template)) {
      if (key.endsWith('.$')) {
        // This is a JSONPath reference - resolve it
        const actualKey = key.slice(0, -2); // Remove .$
        resolved[actualKey] = evaluateJsonPath(value, input, context);
      } else {
        // Recursively resolve nested objects
        resolved[key] = resolveParameters(value, input, context);
      }
    }

    return resolved;
  }

  // Handle arrays
  if (Array.isArray(template)) {
    return template.map(item => resolveParameters(item, input, context));
  }

  // Handle strings that might be JSONPath
  if (typeof template === 'string' && template.startsWith('$')) {
    return evaluateJsonPath(template, input, context);
  }

  // Return primitives as-is
  return template;
}

/**
 * Set value at a path in an object (for ResultPath)
 * Creates nested objects as needed
 *
 * @param {object} obj - Target object
 * @param {string} path - Dot-notation path (e.g., "$.result.data")
 * @param {any} value - Value to set
 * @returns {object} Modified object
 */
export function setByPath(obj, path, value) {
  if (!path || path === '$') {
    return value;
  }

  // Remove leading $. if present
  let cleanPath = path;
  if (cleanPath.startsWith('$.')) {
    cleanPath = cleanPath.slice(2);
  } else if (cleanPath.startsWith('$')) {
    cleanPath = cleanPath.slice(1);
  }

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

/**
 * Apply InputPath to filter input
 *
 * @param {object} input - Raw input
 * @param {string} inputPath - InputPath expression (null means use entire input)
 * @returns {any} Filtered input
 */
export function applyInputPath(input, inputPath) {
  if (inputPath === null) {
    return input;
  }
  if (inputPath === undefined || inputPath === '$') {
    return input;
  }
  return evaluateJsonPath(inputPath, input);
}

/**
 * Apply OutputPath to filter output
 *
 * @param {object} output - Raw output
 * @param {string} outputPath - OutputPath expression (null means discard output)
 * @returns {any} Filtered output
 */
export function applyOutputPath(output, outputPath) {
  if (outputPath === null) {
    return {};
  }
  if (outputPath === undefined || outputPath === '$') {
    return output;
  }
  return evaluateJsonPath(outputPath, output);
}

/**
 * Apply ResultPath to merge result into input
 *
 * @param {object} input - Original input
 * @param {any} result - Task result
 * @param {string} resultPath - ResultPath expression (null means discard result)
 * @returns {object} Merged output
 */
export function applyResultPath(input, result, resultPath) {
  if (resultPath === null) {
    return input;
  }
  if (resultPath === undefined || resultPath === '$') {
    return result;
  }
  return setByPath(input, resultPath, result);
}
