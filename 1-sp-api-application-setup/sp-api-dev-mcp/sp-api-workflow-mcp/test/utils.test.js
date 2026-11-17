/**
 * Tests for utility modules
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  generateUUID,
  generateWorkflowId,
  generateExecutionId,
  generateCallbackId
} from '../src/utils/uuid.js';

import {
  getByPath,
  setByPath,
  evaluateJsonPath,
  resolveParameters,
  applyInputPath,
  applyResultPath
} from '../src/utils/json-path.js';

import {
  validateWorkflow,
  validateState,
  findReachableStates
} from '../src/utils/asl-validator.js';

// UUID Tests
describe('UUID utilities', () => {
  it('should generate valid UUIDs', () => {
    const uuid = generateUUID();
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should generate workflow IDs with prefix', () => {
    const id = generateWorkflowId();
    assert.ok(id.startsWith('wf_'));
    assert.strictEqual(id.length, 15); // wf_ + 12 chars
  });

  it('should generate execution IDs with prefix', () => {
    const id = generateExecutionId();
    assert.ok(id.startsWith('exec_'));
    assert.strictEqual(id.length, 17); // exec_ + 12 chars
  });

  it('should generate callback IDs with prefix', () => {
    const id = generateCallbackId();
    assert.ok(id.startsWith('cb_'));
    assert.strictEqual(id.length, 19); // cb_ + 16 chars
  });
});

// JSONPath Tests
describe('JSONPath utilities', () => {
  const testData = {
    name: 'test',
    nested: {
      value: 42,
      deep: {
        item: 'found'
      }
    },
    items: ['a', 'b', 'c'],
    complex: [
      { id: 1, name: 'first' },
      { id: 2, name: 'second' }
    ]
  };

  describe('getByPath', () => {
    it('should get simple property', () => {
      assert.strictEqual(getByPath(testData, 'name'), 'test');
    });

    it('should get nested property', () => {
      assert.strictEqual(getByPath(testData, 'nested.value'), 42);
    });

    it('should get deeply nested property', () => {
      assert.strictEqual(getByPath(testData, 'nested.deep.item'), 'found');
    });

    it('should get array element', () => {
      assert.strictEqual(getByPath(testData, 'items[1]'), 'b');
    });

    it('should get property from array element', () => {
      assert.strictEqual(getByPath(testData, 'complex[0].name'), 'first');
    });

    it('should return undefined for missing path', () => {
      assert.strictEqual(getByPath(testData, 'missing.path'), undefined);
    });

    it('should return entire object for empty path', () => {
      assert.deepStrictEqual(getByPath(testData, ''), testData);
    });
  });

  describe('evaluateJsonPath', () => {
    it('should evaluate $ as entire input', () => {
      assert.deepStrictEqual(evaluateJsonPath('$', testData), testData);
    });

    it('should evaluate $.path', () => {
      assert.strictEqual(evaluateJsonPath('$.name', testData), 'test');
    });

    it('should evaluate $$.context', () => {
      const context = { Execution: { Id: 'exec123' } };
      assert.strictEqual(evaluateJsonPath('$$.Execution.Id', testData, context), 'exec123');
    });

    it('should return non-path strings as-is', () => {
      assert.strictEqual(evaluateJsonPath('not a path', testData), 'not a path');
    });
  });

  describe('resolveParameters', () => {
    it('should resolve parameters with JSONPath references', () => {
      const template = {
        'name.$': '$.name',
        'static': 'value'
      };
      const result = resolveParameters(template, testData);
      assert.deepStrictEqual(result, {
        name: 'test',
        static: 'value'
      });
    });

    it('should handle nested objects', () => {
      const template = {
        outer: {
          'inner.$': '$.nested.value'
        }
      };
      const result = resolveParameters(template, testData);
      assert.deepStrictEqual(result, {
        outer: {
          inner: 42
        }
      });
    });

    it('should handle arrays', () => {
      const template = ['$.name', '$.nested.value'];
      const result = resolveParameters(template, testData);
      assert.deepStrictEqual(result, ['test', 42]);
    });
  });

  describe('setByPath', () => {
    it('should set value at path', () => {
      const result = setByPath({}, '$.result', { data: 'value' });
      assert.deepStrictEqual(result, { result: { data: 'value' } });
    });

    it('should set nested value', () => {
      const result = setByPath({ existing: true }, '$.nested.new', 'value');
      assert.deepStrictEqual(result, {
        existing: true,
        nested: { new: 'value' }
      });
    });

    it('should replace entire object for $', () => {
      const result = setByPath({ old: true }, '$', { new: true });
      assert.deepStrictEqual(result, { new: true });
    });
  });

  describe('applyResultPath', () => {
    it('should merge result at path', () => {
      const input = { original: 'data' };
      const result = applyResultPath(input, { task: 'result' }, '$.output');
      assert.deepStrictEqual(result, {
        original: 'data',
        output: { task: 'result' }
      });
    });

    it('should discard result for null ResultPath', () => {
      const input = { original: 'data' };
      const result = applyResultPath(input, { task: 'result' }, null);
      assert.deepStrictEqual(result, { original: 'data' });
    });

    it('should replace input for $ ResultPath', () => {
      const input = { original: 'data' };
      const result = applyResultPath(input, { new: 'data' }, '$');
      assert.deepStrictEqual(result, { new: 'data' });
    });
  });
});

// ASL Validator Tests
describe('ASL Validator', () => {
  describe('validateWorkflow', () => {
    it('should validate a simple valid workflow', () => {
      const schema = {
        StartAt: 'Task1',
        States: {
          Task1: {
            Type: 'Task',
            Resource: 'test',
            End: true
          }
        }
      };
      const result = validateWorkflow(schema);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should require StartAt field', () => {
      const schema = {
        States: {
          Task1: { Type: 'Succeed' }
        }
      };
      const result = validateWorkflow(schema);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('StartAt')));
    });

    it('should require States field', () => {
      const schema = {
        StartAt: 'Task1'
      };
      const result = validateWorkflow(schema);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('States')));
    });

    it('should validate StartAt references valid state', () => {
      const schema = {
        StartAt: 'NonExistent',
        States: {
          Task1: { Type: 'Succeed' }
        }
      };
      const result = validateWorkflow(schema);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('NonExistent')));
    });

    it('should detect unreachable states', () => {
      const schema = {
        StartAt: 'Task1',
        States: {
          Task1: { Type: 'Succeed' },
          Unreachable: { Type: 'Succeed' }
        }
      };
      const result = validateWorkflow(schema);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('unreachable')));
    });
  });

  describe('validateState', () => {
    it('should require Type field', () => {
      const errors = validateState('Test', {});
      assert.ok(errors.some(e => e.includes('Type')));
    });

    it('should reject invalid Type', () => {
      const errors = validateState('Test', { Type: 'Invalid' });
      assert.ok(errors.some(e => e.includes('Invalid')));
    });

    it('should validate Task state requires Resource', () => {
      const errors = validateState('Test', { Type: 'Task', End: true });
      assert.ok(errors.some(e => e.includes('Resource')));
    });

    it('should validate Choice state requires Choices', () => {
      const errors = validateState('Test', { Type: 'Choice' });
      assert.ok(errors.some(e => e.includes('Choices')));
    });

    it('should validate state name length', () => {
      const longName = 'a'.repeat(81);
      const errors = validateState(longName, { Type: 'Succeed' });
      assert.ok(errors.some(e => e.includes('80 character')));
    });
  });

  describe('findReachableStates', () => {
    it('should find all reachable states', () => {
      const schema = {
        StartAt: 'A',
        States: {
          A: { Type: 'Pass', Next: 'B' },
          B: { Type: 'Pass', Next: 'C' },
          C: { Type: 'Succeed' }
        }
      };
      const reachable = findReachableStates(schema);
      assert.strictEqual(reachable.size, 3);
      assert.ok(reachable.has('A'));
      assert.ok(reachable.has('B'));
      assert.ok(reachable.has('C'));
    });

    it('should follow Choice state transitions', () => {
      const schema = {
        StartAt: 'Check',
        States: {
          Check: {
            Type: 'Choice',
            Choices: [
              { Variable: '$.x', NumericEquals: 1, Next: 'One' }
            ],
            Default: 'Other'
          },
          One: { Type: 'Succeed' },
          Other: { Type: 'Succeed' }
        }
      };
      const reachable = findReachableStates(schema);
      assert.strictEqual(reachable.size, 3);
      assert.ok(reachable.has('Check'));
      assert.ok(reachable.has('One'));
      assert.ok(reachable.has('Other'));
    });
  });
});
