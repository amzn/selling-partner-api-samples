/**
 * ASL (Amazon States Language) Validator
 * Basic validation for workflow schemas
 *
 * Based on: Amazon States Language Spec
 * https://states-language.net/spec.html
 */

// Valid state types per ASL spec (extended with Input for human-in-the-loop)
const VALID_STATE_TYPES = ['Task', 'Pass', 'Choice', 'Wait', 'Succeed', 'Fail', 'Parallel', 'Map', 'Input'];

// States that can have End: true
const STATES_WITH_END = ['Task', 'Pass', 'Wait', 'Parallel', 'Map', 'Input'];

// Terminal states (don't need Next)
const TERMINAL_STATE_TYPES = ['Succeed', 'Fail'];

// States that must not have Next or End
const NO_TRANSITION_STATES = ['Choice'];

/**
 * Validate a complete ASL workflow schema
 *
 * @param {object} schema - ASL workflow schema
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateWorkflow(schema) {
  const errors = [];

  // Check if schema is an object
  if (!schema || typeof schema !== 'object') {
    return { valid: false, errors: ['Workflow schema must be a JSON object'] };
  }

  // Required: StartAt field
  if (!schema.StartAt) {
    errors.push('Workflow must have a "StartAt" field');
  } else if (typeof schema.StartAt !== 'string') {
    errors.push('"StartAt" must be a string');
  }

  // Required: States field
  if (!schema.States) {
    errors.push('Workflow must have a "States" field');
  } else if (typeof schema.States !== 'object' || Array.isArray(schema.States)) {
    errors.push('"States" must be a JSON object');
  } else {
    // Validate StartAt references a valid state
    if (schema.StartAt && !schema.States[schema.StartAt]) {
      errors.push(`StartAt "${schema.StartAt}" does not reference a valid state`);
    }

    // Validate each state
    for (const [stateName, state] of Object.entries(schema.States)) {
      const stateErrors = validateState(stateName, state, schema.States);
      errors.push(...stateErrors);
    }

    // Check for unreachable states
    const reachableStates = findReachableStates(schema);
    for (const stateName of Object.keys(schema.States)) {
      if (!reachableStates.has(stateName)) {
        errors.push(`State "${stateName}" is unreachable from StartAt`);
      }
    }
  }

  // Optional fields validation
  if (schema.Comment !== undefined && typeof schema.Comment !== 'string') {
    errors.push('"Comment" must be a string');
  }

  if (schema.Version !== undefined && typeof schema.Version !== 'string') {
    errors.push('"Version" must be a string');
  }

  if (schema.TimeoutSeconds !== undefined) {
    if (typeof schema.TimeoutSeconds !== 'number' || !Number.isInteger(schema.TimeoutSeconds)) {
      errors.push('"TimeoutSeconds" must be an integer');
    } else if (schema.TimeoutSeconds <= 0) {
      errors.push('"TimeoutSeconds" must be positive');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a single state
 *
 * @param {string} stateName - Name of the state
 * @param {object} state - State definition
 * @param {object} allStates - All states in the workflow (for transition validation)
 * @returns {string[]} Array of error messages
 */
export function validateState(stateName, state, allStates = {}) {
  const errors = [];

  // State name validation
  if (!stateName || typeof stateName !== 'string') {
    errors.push('State name must be a non-empty string');
    return errors;
  }

  if (stateName.length > 80) {
    errors.push(`State name "${stateName}" exceeds 80 character limit`);
  }

  // State must be an object
  if (!state || typeof state !== 'object') {
    errors.push(`State "${stateName}" must be a JSON object`);
    return errors;
  }

  // Type is required
  if (!state.Type) {
    errors.push(`State "${stateName}" must have a "Type" field`);
    return errors;
  }

  if (!VALID_STATE_TYPES.includes(state.Type)) {
    errors.push(`State "${stateName}" has invalid Type "${state.Type}". Valid types: ${VALID_STATE_TYPES.join(', ')}`);
    return errors;
  }

  // Validate based on state type
  switch (state.Type) {
    case 'Task':
      errors.push(...validateTaskState(stateName, state, allStates));
      break;
    case 'Pass':
      errors.push(...validatePassState(stateName, state, allStates));
      break;
    case 'Choice':
      errors.push(...validateChoiceState(stateName, state, allStates));
      break;
    case 'Wait':
      errors.push(...validateWaitState(stateName, state, allStates));
      break;
    case 'Succeed':
      errors.push(...validateSucceedState(stateName, state));
      break;
    case 'Fail':
      errors.push(...validateFailState(stateName, state));
      break;
    case 'Parallel':
      errors.push(...validateParallelState(stateName, state, allStates));
      break;
    case 'Map':
      errors.push(...validateMapState(stateName, state, allStates));
      break;
    case 'Input':
      errors.push(...validateInputState(stateName, state, allStates));
      break;
  }

  return errors;
}

/**
 * Validate Task state
 */
function validateTaskState(stateName, state, allStates) {
  const errors = [];

  // Resource is required for Task states
  if (!state.Resource) {
    errors.push(`Task state "${stateName}" must have a "Resource" field`);
  }

  // Must have Next or End
  errors.push(...validateTransition(stateName, state, allStates));

  // Validate Retry if present
  if (state.Retry !== undefined) {
    errors.push(...validateRetry(stateName, state.Retry));
  }

  // Validate Catch if present
  if (state.Catch !== undefined) {
    errors.push(...validateCatch(stateName, state.Catch, allStates));
  }

  return errors;
}

/**
 * Validate Pass state
 */
function validatePassState(stateName, state, allStates) {
  const errors = [];

  // Must have Next or End
  errors.push(...validateTransition(stateName, state, allStates));

  return errors;
}

/**
 * Validate Choice state
 */
function validateChoiceState(stateName, state, allStates) {
  const errors = [];

  // Choices array is required
  if (!state.Choices) {
    errors.push(`Choice state "${stateName}" must have a "Choices" field`);
  } else if (!Array.isArray(state.Choices)) {
    errors.push(`Choice state "${stateName}" "Choices" must be an array`);
  } else if (state.Choices.length === 0) {
    errors.push(`Choice state "${stateName}" "Choices" must not be empty`);
  } else {
    // Validate each choice rule
    for (let i = 0; i < state.Choices.length; i++) {
      const choice = state.Choices[i];
      errors.push(...validateChoiceRule(stateName, choice, i, allStates));
    }
  }

  // Choice state must not have End
  if (state.End !== undefined) {
    errors.push(`Choice state "${stateName}" must not have "End" field`);
  }

  // Choice state must not have Next at top level
  if (state.Next !== undefined) {
    errors.push(`Choice state "${stateName}" must not have "Next" field at top level`);
  }

  // Default is optional but must reference valid state
  if (state.Default !== undefined) {
    if (typeof state.Default !== 'string') {
      errors.push(`Choice state "${stateName}" "Default" must be a string`);
    } else if (allStates && !allStates[state.Default]) {
      errors.push(`Choice state "${stateName}" Default "${state.Default}" references non-existent state`);
    }
  }

  return errors;
}

/**
 * Validate a choice rule
 */
function validateChoiceRule(stateName, rule, index, allStates) {
  const errors = [];
  const prefix = `Choice state "${stateName}" rule ${index}`;

  if (!rule || typeof rule !== 'object') {
    errors.push(`${prefix} must be a JSON object`);
    return errors;
  }

  // Each rule must have Next
  if (!rule.Next) {
    errors.push(`${prefix} must have a "Next" field`);
  } else if (typeof rule.Next !== 'string') {
    errors.push(`${prefix} "Next" must be a string`);
  } else if (allStates && !allStates[rule.Next]) {
    errors.push(`${prefix} Next "${rule.Next}" references non-existent state`);
  }

  // Must have at least one comparison operator or boolean expression
  const hasComparison = hasComparisonOperator(rule);
  const hasBooleanOp = rule.And || rule.Or || rule.Not;

  if (!hasComparison && !hasBooleanOp) {
    errors.push(`${prefix} must have a comparison operator or boolean expression`);
  }

  return errors;
}

/**
 * Check if a choice rule has a comparison operator
 */
function hasComparisonOperator(rule) {
  const operators = [
    'StringEquals', 'StringEqualsPath', 'StringLessThan', 'StringLessThanPath',
    'StringGreaterThan', 'StringGreaterThanPath', 'StringLessThanEquals',
    'StringLessThanEqualsPath', 'StringGreaterThanEquals', 'StringGreaterThanEqualsPath',
    'StringMatches', 'NumericEquals', 'NumericEqualsPath', 'NumericLessThan',
    'NumericLessThanPath', 'NumericGreaterThan', 'NumericGreaterThanPath',
    'NumericLessThanEquals', 'NumericLessThanEqualsPath', 'NumericGreaterThanEquals',
    'NumericGreaterThanEqualsPath', 'BooleanEquals', 'BooleanEqualsPath',
    'TimestampEquals', 'TimestampEqualsPath', 'TimestampLessThan',
    'TimestampLessThanPath', 'TimestampGreaterThan', 'TimestampGreaterThanPath',
    'TimestampLessThanEquals', 'TimestampLessThanEqualsPath',
    'TimestampGreaterThanEquals', 'TimestampGreaterThanEqualsPath',
    'IsNull', 'IsPresent', 'IsNumeric', 'IsString', 'IsBoolean', 'IsTimestamp'
  ];

  return operators.some(op => rule[op] !== undefined);
}

/**
 * Validate Wait state
 */
function validateWaitState(stateName, state, allStates) {
  const errors = [];

  // Must have one of: Seconds, Timestamp, SecondsPath, TimestampPath
  const hasSeconds = state.Seconds !== undefined;
  const hasTimestamp = state.Timestamp !== undefined;
  const hasSecondsPath = state.SecondsPath !== undefined;
  const hasTimestampPath = state.TimestampPath !== undefined;

  const waitFields = [hasSeconds, hasTimestamp, hasSecondsPath, hasTimestampPath].filter(Boolean).length;

  if (waitFields === 0) {
    errors.push(`Wait state "${stateName}" must have one of: Seconds, Timestamp, SecondsPath, TimestampPath`);
  } else if (waitFields > 1) {
    errors.push(`Wait state "${stateName}" must have only one of: Seconds, Timestamp, SecondsPath, TimestampPath`);
  }

  // Must have Next or End
  errors.push(...validateTransition(stateName, state, allStates));

  return errors;
}

/**
 * Validate Succeed state
 */
function validateSucceedState(stateName, state) {
  const errors = [];

  // Succeed state must not have Next
  if (state.Next !== undefined) {
    errors.push(`Succeed state "${stateName}" must not have "Next" field`);
  }

  // Succeed state must not have End
  if (state.End !== undefined) {
    errors.push(`Succeed state "${stateName}" must not have "End" field`);
  }

  return errors;
}

/**
 * Validate Fail state
 */
function validateFailState(stateName, state) {
  const errors = [];

  // Fail state must not have Next
  if (state.Next !== undefined) {
    errors.push(`Fail state "${stateName}" must not have "Next" field`);
  }

  // Fail state must not have End
  if (state.End !== undefined) {
    errors.push(`Fail state "${stateName}" must not have "End" field`);
  }

  return errors;
}

/**
 * Validate Parallel state
 */
function validateParallelState(stateName, state, allStates) {
  const errors = [];

  // Branches is required
  if (!state.Branches) {
    errors.push(`Parallel state "${stateName}" must have a "Branches" field`);
  } else if (!Array.isArray(state.Branches)) {
    errors.push(`Parallel state "${stateName}" "Branches" must be an array`);
  } else if (state.Branches.length === 0) {
    errors.push(`Parallel state "${stateName}" "Branches" must not be empty`);
  } else {
    // Validate each branch as a sub-workflow
    for (let i = 0; i < state.Branches.length; i++) {
      const branch = state.Branches[i];
      const branchResult = validateWorkflow(branch);
      for (const error of branchResult.errors) {
        errors.push(`Parallel state "${stateName}" branch ${i}: ${error}`);
      }
    }
  }

  // Must have Next or End
  errors.push(...validateTransition(stateName, state, allStates));

  // Validate Retry if present
  if (state.Retry !== undefined) {
    errors.push(...validateRetry(stateName, state.Retry));
  }

  // Validate Catch if present
  if (state.Catch !== undefined) {
    errors.push(...validateCatch(stateName, state.Catch, allStates));
  }

  return errors;
}

/**
 * Validate Map state
 */
function validateMapState(stateName, state, allStates) {
  const errors = [];

  // ItemProcessor or Iterator is required (ItemProcessor is newer)
  const hasItemProcessor = state.ItemProcessor !== undefined;
  const hasIterator = state.Iterator !== undefined;

  if (!hasItemProcessor && !hasIterator) {
    errors.push(`Map state "${stateName}" must have an "ItemProcessor" or "Iterator" field`);
  } else {
    const processor = state.ItemProcessor || state.Iterator;
    const processorResult = validateWorkflow(processor);
    for (const error of processorResult.errors) {
      errors.push(`Map state "${stateName}" ItemProcessor: ${error}`);
    }
  }

  // Must have Next or End
  errors.push(...validateTransition(stateName, state, allStates));

  // Validate Retry if present
  if (state.Retry !== undefined) {
    errors.push(...validateRetry(stateName, state.Retry));
  }

  // Validate Catch if present
  if (state.Catch !== undefined) {
    errors.push(...validateCatch(stateName, state.Catch, allStates));
  }

  return errors;
}

/**
 * Validate Input state (human-in-the-loop)
 */
function validateInputState(stateName, state, allStates) {
  const errors = [];

  // InputType is required
  if (!state.InputType) {
    errors.push(`Input state "${stateName}" must have an "InputType" field`);
  } else {
    const validInputTypes = ['SingleSelect', 'MultiSelect', 'Boolean', 'Text', 'Number', 'Date', 'Form', 'Confirm', 'Table', 'JSON'];
    if (!validInputTypes.includes(state.InputType)) {
      errors.push(`Input state "${stateName}" has invalid InputType "${state.InputType}". Valid types: ${validInputTypes.join(', ')}`);
    }
  }

  // Title is required
  if (!state.Title) {
    errors.push(`Input state "${stateName}" must have a "Title" field`);
  }

  // ResultPath is required
  if (!state.ResultPath) {
    errors.push(`Input state "${stateName}" must have a "ResultPath" field`);
  }

  // Must have Next or End
  errors.push(...validateTransition(stateName, state, allStates));

  return errors;
}

/**
 * Validate state transition (Next or End)
 */
function validateTransition(stateName, state, allStates) {
  const errors = [];

  const hasNext = state.Next !== undefined;
  const hasEnd = state.End !== undefined;

  if (!hasNext && !hasEnd) {
    errors.push(`State "${stateName}" must have either "Next" or "End" field`);
  } else if (hasNext && hasEnd) {
    errors.push(`State "${stateName}" cannot have both "Next" and "End" fields`);
  } else if (hasNext) {
    if (typeof state.Next !== 'string') {
      errors.push(`State "${stateName}" "Next" must be a string`);
    } else if (allStates && !allStates[state.Next]) {
      errors.push(`State "${stateName}" Next "${state.Next}" references non-existent state`);
    }
  } else if (hasEnd && state.End !== true) {
    errors.push(`State "${stateName}" "End" must be true`);
  }

  return errors;
}

/**
 * Validate Retry array
 */
function validateRetry(stateName, retry) {
  const errors = [];

  if (!Array.isArray(retry)) {
    errors.push(`State "${stateName}" "Retry" must be an array`);
    return errors;
  }

  for (let i = 0; i < retry.length; i++) {
    const retrier = retry[i];
    const prefix = `State "${stateName}" Retry[${i}]`;

    if (!retrier || typeof retrier !== 'object') {
      errors.push(`${prefix} must be a JSON object`);
      continue;
    }

    if (!retrier.ErrorEquals) {
      errors.push(`${prefix} must have "ErrorEquals" field`);
    } else if (!Array.isArray(retrier.ErrorEquals)) {
      errors.push(`${prefix} "ErrorEquals" must be an array`);
    }

    if (retrier.MaxAttempts !== undefined) {
      if (typeof retrier.MaxAttempts !== 'number' || !Number.isInteger(retrier.MaxAttempts)) {
        errors.push(`${prefix} "MaxAttempts" must be an integer`);
      } else if (retrier.MaxAttempts < 0) {
        errors.push(`${prefix} "MaxAttempts" must be non-negative`);
      }
    }

    if (retrier.IntervalSeconds !== undefined) {
      if (typeof retrier.IntervalSeconds !== 'number' || !Number.isInteger(retrier.IntervalSeconds)) {
        errors.push(`${prefix} "IntervalSeconds" must be an integer`);
      } else if (retrier.IntervalSeconds < 1) {
        errors.push(`${prefix} "IntervalSeconds" must be at least 1`);
      }
    }

    if (retrier.BackoffRate !== undefined) {
      if (typeof retrier.BackoffRate !== 'number') {
        errors.push(`${prefix} "BackoffRate" must be a number`);
      } else if (retrier.BackoffRate < 1.0) {
        errors.push(`${prefix} "BackoffRate" must be at least 1.0`);
      }
    }
  }

  return errors;
}

/**
 * Validate Catch array
 */
function validateCatch(stateName, catchers, allStates) {
  const errors = [];

  if (!Array.isArray(catchers)) {
    errors.push(`State "${stateName}" "Catch" must be an array`);
    return errors;
  }

  for (let i = 0; i < catchers.length; i++) {
    const catcher = catchers[i];
    const prefix = `State "${stateName}" Catch[${i}]`;

    if (!catcher || typeof catcher !== 'object') {
      errors.push(`${prefix} must be a JSON object`);
      continue;
    }

    if (!catcher.ErrorEquals) {
      errors.push(`${prefix} must have "ErrorEquals" field`);
    } else if (!Array.isArray(catcher.ErrorEquals)) {
      errors.push(`${prefix} "ErrorEquals" must be an array`);
    }

    if (!catcher.Next) {
      errors.push(`${prefix} must have "Next" field`);
    } else if (typeof catcher.Next !== 'string') {
      errors.push(`${prefix} "Next" must be a string`);
    } else if (allStates && !allStates[catcher.Next]) {
      errors.push(`${prefix} Next "${catcher.Next}" references non-existent state`);
    }
  }

  return errors;
}

/**
 * Find all states reachable from StartAt
 *
 * @param {object} schema - ASL workflow schema
 * @returns {Set<string>} Set of reachable state names
 */
export function findReachableStates(schema) {
  const reachable = new Set();

  if (!schema.StartAt || !schema.States) {
    return reachable;
  }

  const toVisit = [schema.StartAt];

  while (toVisit.length > 0) {
    const stateName = toVisit.pop();

    if (reachable.has(stateName)) {
      continue;
    }

    const state = schema.States[stateName];
    if (!state) {
      continue;
    }

    reachable.add(stateName);

    // Add Next state
    if (state.Next) {
      toVisit.push(state.Next);
    }

    // Add Choice state transitions
    if (state.Type === 'Choice') {
      if (state.Choices) {
        for (const choice of state.Choices) {
          if (choice.Next) {
            toVisit.push(choice.Next);
          }
        }
      }
      if (state.Default) {
        toVisit.push(state.Default);
      }
    }

    // Add Catch transitions
    if (state.Catch) {
      for (const catcher of state.Catch) {
        if (catcher.Next) {
          toVisit.push(catcher.Next);
        }
      }
    }

    // Note: We don't traverse into Parallel branches or Map iterators
    // as they are separate scopes
  }

  return reachable;
}

/**
 * Check if workflow has at least one terminal state
 *
 * @param {object} schema - ASL workflow schema
 * @returns {boolean} True if workflow has a terminal state
 */
export function hasTerminalState(schema) {
  if (!schema.States) {
    return false;
  }

  for (const state of Object.values(schema.States)) {
    if (state.Type === 'Succeed' || state.Type === 'Fail' || state.End === true) {
      return true;
    }
  }

  return false;
}
