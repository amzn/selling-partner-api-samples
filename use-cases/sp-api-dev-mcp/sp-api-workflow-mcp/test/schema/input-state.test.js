/**
 * Input State Schema Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  VALID_INPUT_TYPES,
  createInputState,
  validateInputState,
  isInputState
} from '../../src/schema/input-state.js';

describe('Input State Schema', () => {
  describe('VALID_INPUT_TYPES', () => {
    it('should contain all 10 input types', () => {
      assert.strictEqual(VALID_INPUT_TYPES.length, 10);
      assert.ok(VALID_INPUT_TYPES.includes('SingleSelect'));
      assert.ok(VALID_INPUT_TYPES.includes('MultiSelect'));
      assert.ok(VALID_INPUT_TYPES.includes('Boolean'));
      assert.ok(VALID_INPUT_TYPES.includes('Text'));
      assert.ok(VALID_INPUT_TYPES.includes('Number'));
      assert.ok(VALID_INPUT_TYPES.includes('Date'));
      assert.ok(VALID_INPUT_TYPES.includes('Form'));
      assert.ok(VALID_INPUT_TYPES.includes('Confirm'));
      assert.ok(VALID_INPUT_TYPES.includes('Table'));
      assert.ok(VALID_INPUT_TYPES.includes('JSON'));
    });
  });

  describe('createInputState', () => {
    it('should create a basic SingleSelect state', () => {
      const state = createInputState('SingleSelect', {
        title: 'Select Option',
        resultPath: '$.selection',
        optionsPath: '$.options',
        optionLabel: 'name'
      });

      assert.strictEqual(state.Type, 'Input');
      assert.strictEqual(state.InputType, 'SingleSelect');
      assert.strictEqual(state.Title, 'Select Option');
      assert.strictEqual(state.ResultPath, '$.selection');
      assert.strictEqual(state['Options.$'], '$.options');
      assert.strictEqual(state.OptionLabel, 'name');
      assert.strictEqual(state.Required, true);
      assert.strictEqual(state.Timeout, 3600);
      assert.strictEqual(state.End, true);
    });

    it('should create a state with Next instead of End', () => {
      const state = createInputState('Boolean', {
        title: 'Continue?',
        resultPath: '$.continue',
        next: 'NextState'
      });

      assert.strictEqual(state.Next, 'NextState');
      assert.strictEqual(state.End, undefined);
    });

    it('should add description when provided', () => {
      const state = createInputState('Text', {
        title: 'Enter Name',
        description: 'Please enter your full name',
        resultPath: '$.name'
      });

      assert.strictEqual(state.Description, 'Please enter your full name');
    });

    it('should set custom timeout', () => {
      const state = createInputState('Number', {
        title: 'Enter Quantity',
        resultPath: '$.qty',
        timeout: 7200
      });

      assert.strictEqual(state.Timeout, 7200);
    });

    it('should throw error for invalid input type', () => {
      assert.throws(() => {
        createInputState('Invalid', { title: 'Test', resultPath: '$.test' });
      }, /Invalid input type: Invalid/);
    });
  });

  describe('validateInputState', () => {
    it('should validate a correct Input state', () => {
      const state = {
        Type: 'Input',
        InputType: 'SingleSelect',
        Title: 'Select Option',
        ResultPath: '$.selection',
        'Options.$': '$.options',
        OptionLabel: 'name',
        Next: 'NextState'
      };

      const result = validateInputState('TestState', state);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should fail when Type is not Input', () => {
      const state = {
        Type: 'Task',
        InputType: 'SingleSelect',
        Title: 'Test',
        ResultPath: '$.test',
        Next: 'NextState'
      };

      const result = validateInputState('TestState', state);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes("TestState: Type must be 'Input'"));
    });

    it('should fail when InputType is missing', () => {
      const state = {
        Type: 'Input',
        Title: 'Test',
        ResultPath: '$.test',
        Next: 'NextState'
      };

      const result = validateInputState('TestState', state);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes('TestState: InputType is required'));
    });

    it('should fail when InputType is invalid', () => {
      const state = {
        Type: 'Input',
        InputType: 'InvalidType',
        Title: 'Test',
        ResultPath: '$.test',
        Next: 'NextState'
      };

      const result = validateInputState('TestState', state);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid InputType')));
    });

    it('should fail when Title is missing', () => {
      const state = {
        Type: 'Input',
        InputType: 'Boolean',
        ResultPath: '$.test',
        Next: 'NextState'
      };

      const result = validateInputState('TestState', state);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes('TestState: Title is required'));
    });

    it('should fail when ResultPath is missing', () => {
      const state = {
        Type: 'Input',
        InputType: 'Boolean',
        Title: 'Test',
        Next: 'NextState'
      };

      const result = validateInputState('TestState', state);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes('TestState: ResultPath is required'));
    });

    it('should fail when ResultPath is invalid', () => {
      const state = {
        Type: 'Input',
        InputType: 'Boolean',
        Title: 'Test',
        ResultPath: 'invalid',
        Next: 'NextState'
      };

      const result = validateInputState('TestState', state);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('JSONPath')));
    });

    it('should fail when both Next and End are set', () => {
      const state = {
        Type: 'Input',
        InputType: 'Boolean',
        Title: 'Test',
        ResultPath: '$.test',
        Next: 'NextState',
        End: true
      };

      const result = validateInputState('TestState', state);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes('TestState: Cannot have both Next and End'));
    });

    it('should fail when neither Next nor End is set', () => {
      const state = {
        Type: 'Input',
        InputType: 'Boolean',
        Title: 'Test',
        ResultPath: '$.test'
      };

      const result = validateInputState('TestState', state);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes('TestState: Must have either Next or End'));
    });

    it('should fail when Timeout is invalid', () => {
      const state = {
        Type: 'Input',
        InputType: 'Boolean',
        Title: 'Test',
        ResultPath: '$.test',
        Timeout: -1,
        Next: 'NextState'
      };

      const result = validateInputState('TestState', state);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Timeout')));
    });

    it('should fail when Timeout exceeds maximum', () => {
      const state = {
        Type: 'Input',
        InputType: 'Boolean',
        Title: 'Test',
        ResultPath: '$.test',
        Timeout: 100000,
        Next: 'NextState'
      };

      const result = validateInputState('TestState', state);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('86400')));
    });
  });

  describe('isInputState', () => {
    it('should return true for Input state', () => {
      assert.strictEqual(isInputState({ Type: 'Input' }), true);
    });

    it('should return false for non-Input state', () => {
      assert.strictEqual(isInputState({ Type: 'Task' }), false);
      assert.strictEqual(isInputState({ Type: 'Choice' }), false);
      assert.strictEqual(isInputState(null), false);
      assert.strictEqual(isInputState(undefined), false);
    });
  });
});
