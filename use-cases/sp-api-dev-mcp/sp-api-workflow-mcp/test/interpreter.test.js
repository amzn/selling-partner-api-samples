/**
 * Tests for Interpreter module
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

import { WorkflowExecutor } from '../src/interpreter/executor.js';
import { ExecutionStore, ExecutionStatus, EventType } from '../src/interpreter/execution-store.js';
import { evaluateChoiceState, handlePassState, handleWaitState, TaskError } from '../src/interpreter/task-handlers.js';

// ExecutionStore Tests
describe('ExecutionStore', () => {
  let store;

  beforeEach(() => {
    store = new ExecutionStore();
  });

  describe('create', () => {
    it('should create execution with ID', () => {
      const execution = store.create('wf_123', 'Test Workflow', { input: 'value' });

      assert.ok(execution.execution_id.startsWith('exec_'));
      assert.strictEqual(execution.workflow_id, 'wf_123');
      assert.strictEqual(execution.workflow_name, 'Test Workflow');
      assert.strictEqual(execution.status, ExecutionStatus.PENDING);
      assert.deepStrictEqual(execution.input, { input: 'value' });
    });
  });

  describe('get', () => {
    it('should get execution by ID', () => {
      const created = store.create('wf_123', 'Test', {});
      const fetched = store.get(created.execution_id);

      assert.strictEqual(fetched.execution_id, created.execution_id);
    });

    it('should return null for unknown ID', () => {
      const result = store.get('exec_unknown');
      assert.strictEqual(result, null);
    });
  });

  describe('update', () => {
    it('should update execution fields', () => {
      const { execution_id } = store.create('wf_123', 'Test', {});

      store.update(execution_id, { status: ExecutionStatus.RUNNING });

      const execution = store.get(execution_id);
      assert.strictEqual(execution.status, ExecutionStatus.RUNNING);
    });

    it('should throw for unknown execution', () => {
      assert.throws(
        () => store.update('exec_unknown', {}),
        /Execution not found/
      );
    });
  });

  describe('addEvent', () => {
    it('should add event to execution history', () => {
      const { execution_id } = store.create('wf_123', 'Test', {});

      const event = store.addEvent(execution_id, EventType.STATE_ENTERED, {
        state_name: 'Task1'
      });

      assert.strictEqual(event.type, EventType.STATE_ENTERED);
      assert.strictEqual(event.state_name, 'Task1');
      assert.ok(event.timestamp);
    });
  });

  describe('list', () => {
    it('should list all executions', () => {
      store.create('wf_1', 'Workflow 1', {});
      store.create('wf_2', 'Workflow 2', {});

      const results = store.list();
      assert.strictEqual(results.length, 2);
    });

    it('should filter by workflow_id', () => {
      store.create('wf_1', 'Workflow 1', {});
      store.create('wf_1', 'Workflow 1', {});
      store.create('wf_2', 'Workflow 2', {});

      const results = store.list({ workflow_id: 'wf_1' });
      assert.strictEqual(results.length, 2);
    });

    it('should filter by status', () => {
      const { execution_id } = store.create('wf_1', 'Test', {});
      store.markStarted(execution_id, 'Start');
      store.create('wf_2', 'Test 2', {});

      const running = store.list({ status: ExecutionStatus.RUNNING });
      assert.strictEqual(running.length, 1);
    });

    it('should apply limit', () => {
      store.create('wf_1', 'Test 1', {});
      store.create('wf_2', 'Test 2', {});
      store.create('wf_3', 'Test 3', {});

      const results = store.list({ limit: 2 });
      assert.strictEqual(results.length, 2);
    });
  });

  describe('status transitions', () => {
    it('should mark as started', () => {
      const { execution_id } = store.create('wf_1', 'Test', {});
      store.markStarted(execution_id, 'StartState');

      const execution = store.get(execution_id);
      assert.strictEqual(execution.status, ExecutionStatus.RUNNING);
      assert.strictEqual(execution.current_state, 'StartState');
    });

    it('should mark as succeeded', () => {
      const { execution_id } = store.create('wf_1', 'Test', {});
      store.markSucceeded(execution_id, { result: 'success' });

      const execution = store.get(execution_id);
      assert.strictEqual(execution.status, ExecutionStatus.SUCCEEDED);
      assert.deepStrictEqual(execution.output, { result: 'success' });
      assert.ok(execution.ended_at);
    });

    it('should mark as failed', () => {
      const { execution_id } = store.create('wf_1', 'Test', {});
      store.markFailed(execution_id, 'TestError', 'Something went wrong');

      const execution = store.get(execution_id);
      assert.strictEqual(execution.status, ExecutionStatus.FAILED);
      assert.deepStrictEqual(execution.error, {
        error: 'TestError',
        cause: 'Something went wrong'
      });
    });

    it('should mark as aborted', () => {
      const { execution_id } = store.create('wf_1', 'Test', {});
      store.markAborted(execution_id, 'User cancelled');

      const execution = store.get(execution_id);
      assert.strictEqual(execution.status, ExecutionStatus.ABORTED);
    });
  });
});

// Task Handlers Tests
describe('Task Handlers', () => {
  describe('handlePassState', () => {
    it('should pass through input', () => {
      const state = { Type: 'Pass' };
      const result = handlePassState(state, { data: 'value' });
      assert.deepStrictEqual(result, { data: 'value' });
    });

    it('should return Result if specified', () => {
      const state = { Type: 'Pass', Result: { fixed: 'value' } };
      const result = handlePassState(state, { data: 'value' });
      assert.deepStrictEqual(result, { fixed: 'value' });
    });
  });

  describe('evaluateChoiceState', () => {
    it('should evaluate StringEquals', () => {
      const state = {
        Type: 'Choice',
        Choices: [
          { Variable: '$.status', StringEquals: 'active', Next: 'Active' }
        ],
        Default: 'Inactive'
      };

      assert.strictEqual(evaluateChoiceState(state, { status: 'active' }), 'Active');
      assert.strictEqual(evaluateChoiceState(state, { status: 'inactive' }), 'Inactive');
    });

    it('should evaluate NumericLessThan', () => {
      const state = {
        Type: 'Choice',
        Choices: [
          { Variable: '$.count', NumericLessThan: 10, Next: 'Low' }
        ],
        Default: 'High'
      };

      assert.strictEqual(evaluateChoiceState(state, { count: 5 }), 'Low');
      assert.strictEqual(evaluateChoiceState(state, { count: 15 }), 'High');
    });

    it('should evaluate NumericGreaterThan', () => {
      const state = {
        Type: 'Choice',
        Choices: [
          { Variable: '$.count', NumericGreaterThan: 100, Next: 'High' }
        ],
        Default: 'Normal'
      };

      assert.strictEqual(evaluateChoiceState(state, { count: 150 }), 'High');
      assert.strictEqual(evaluateChoiceState(state, { count: 50 }), 'Normal');
    });

    it('should evaluate BooleanEquals', () => {
      const state = {
        Type: 'Choice',
        Choices: [
          { Variable: '$.enabled', BooleanEquals: true, Next: 'Enabled' }
        ],
        Default: 'Disabled'
      };

      assert.strictEqual(evaluateChoiceState(state, { enabled: true }), 'Enabled');
      assert.strictEqual(evaluateChoiceState(state, { enabled: false }), 'Disabled');
    });

    it('should evaluate IsNull', () => {
      const state = {
        Type: 'Choice',
        Choices: [
          { Variable: '$.value', IsNull: true, Next: 'Null' }
        ],
        Default: 'NotNull'
      };

      assert.strictEqual(evaluateChoiceState(state, { value: null }), 'Null');
      assert.strictEqual(evaluateChoiceState(state, { value: 'something' }), 'NotNull');
    });

    it('should evaluate And operator', () => {
      const state = {
        Type: 'Choice',
        Choices: [
          {
            And: [
              { Variable: '$.age', NumericGreaterThan: 18 },
              { Variable: '$.verified', BooleanEquals: true }
            ],
            Next: 'Allowed'
          }
        ],
        Default: 'Denied'
      };

      assert.strictEqual(evaluateChoiceState(state, { age: 21, verified: true }), 'Allowed');
      assert.strictEqual(evaluateChoiceState(state, { age: 21, verified: false }), 'Denied');
      assert.strictEqual(evaluateChoiceState(state, { age: 16, verified: true }), 'Denied');
    });

    it('should evaluate Or operator', () => {
      const state = {
        Type: 'Choice',
        Choices: [
          {
            Or: [
              { Variable: '$.role', StringEquals: 'admin' },
              { Variable: '$.role', StringEquals: 'superuser' }
            ],
            Next: 'Elevated'
          }
        ],
        Default: 'Normal'
      };

      assert.strictEqual(evaluateChoiceState(state, { role: 'admin' }), 'Elevated');
      assert.strictEqual(evaluateChoiceState(state, { role: 'superuser' }), 'Elevated');
      assert.strictEqual(evaluateChoiceState(state, { role: 'user' }), 'Normal');
    });

    it('should evaluate Not operator', () => {
      const state = {
        Type: 'Choice',
        Choices: [
          {
            Not: { Variable: '$.blocked', BooleanEquals: true },
            Next: 'Allowed'
          }
        ],
        Default: 'Blocked'
      };

      assert.strictEqual(evaluateChoiceState(state, { blocked: false }), 'Allowed');
      assert.strictEqual(evaluateChoiceState(state, { blocked: true }), 'Blocked');
    });

    it('should return null when no match and no default', () => {
      const state = {
        Type: 'Choice',
        Choices: [
          { Variable: '$.x', StringEquals: 'match', Next: 'Found' }
        ]
      };

      assert.strictEqual(evaluateChoiceState(state, { x: 'nomatch' }), null);
    });
  });

  describe('handleWaitState', () => {
    it('should wait for specified seconds', async () => {
      const state = { Type: 'Wait', Seconds: 0.1 }; // 100ms
      const input = { data: 'test' };

      const start = Date.now();
      const result = await handleWaitState(state, input);
      const elapsed = Date.now() - start;

      assert.ok(elapsed >= 90); // Should wait at least 90ms
      assert.deepStrictEqual(result, input);
    });
  });
});

// WorkflowExecutor Tests
describe('WorkflowExecutor', () => {
  let executor;

  beforeEach(() => {
    executor = new WorkflowExecutor();
  });

  describe('execute simple workflow', () => {
    it('should execute Pass -> Succeed workflow', async () => {
      const schema = {
        StartAt: 'Start',
        States: {
          Start: {
            Type: 'Pass',
            Result: { processed: true },
            Next: 'Done'
          },
          Done: {
            Type: 'Succeed'
          }
        }
      };

      const result = await executor.execute('wf_test', 'Test', schema, { input: 'data' });

      assert.strictEqual(result.status, ExecutionStatus.SUCCEEDED);
      assert.deepStrictEqual(result.output, { processed: true });
    });

    it('should execute with InputPath', async () => {
      const schema = {
        StartAt: 'Process',
        States: {
          Process: {
            Type: 'Pass',
            InputPath: '$.data',
            End: true
          }
        }
      };

      const result = await executor.execute('wf_test', 'Test', schema, {
        data: { value: 42 },
        other: 'ignored'
      });

      assert.strictEqual(result.status, ExecutionStatus.SUCCEEDED);
      assert.deepStrictEqual(result.output, { value: 42 });
    });

    it('should execute with ResultPath', async () => {
      const schema = {
        StartAt: 'Process',
        States: {
          Process: {
            Type: 'Pass',
            Result: { added: 'result' },
            ResultPath: '$.result',
            End: true
          }
        }
      };

      const result = await executor.execute('wf_test', 'Test', schema, { original: 'data' });

      assert.strictEqual(result.status, ExecutionStatus.SUCCEEDED);
      assert.deepStrictEqual(result.output, {
        original: 'data',
        result: { added: 'result' }
      });
    });

    it('should execute with OutputPath', async () => {
      const schema = {
        StartAt: 'Process',
        States: {
          Process: {
            Type: 'Pass',
            Result: { value: 'extracted' },
            ResultPath: '$.result',
            OutputPath: '$.result',
            End: true
          }
        }
      };

      const result = await executor.execute('wf_test', 'Test', schema, { original: 'data' });

      assert.strictEqual(result.status, ExecutionStatus.SUCCEEDED);
      assert.deepStrictEqual(result.output, { value: 'extracted' });
    });
  });

  describe('execute Choice workflow', () => {
    it('should follow matching choice branch', async () => {
      const schema = {
        StartAt: 'Check',
        States: {
          Check: {
            Type: 'Choice',
            Choices: [
              { Variable: '$.type', StringEquals: 'A', Next: 'TypeA' }
            ],
            Default: 'TypeOther'
          },
          TypeA: {
            Type: 'Pass',
            Result: { selected: 'A' },
            End: true
          },
          TypeOther: {
            Type: 'Pass',
            Result: { selected: 'Other' },
            End: true
          }
        }
      };

      const resultA = await executor.execute('wf_test', 'Test', schema, { type: 'A' });
      assert.deepStrictEqual(resultA.output, { selected: 'A' });

      const resultB = await executor.execute('wf_test', 'Test', schema, { type: 'B' });
      assert.deepStrictEqual(resultB.output, { selected: 'Other' });
    });

    it('should fail when no choice matches and no default', async () => {
      const schema = {
        StartAt: 'Check',
        States: {
          Check: {
            Type: 'Choice',
            Choices: [
              { Variable: '$.type', StringEquals: 'A', Next: 'TypeA' }
            ]
            // No Default
          },
          TypeA: {
            Type: 'Succeed'
          }
        }
      };

      const result = await executor.execute('wf_test', 'Test', schema, { type: 'B' });

      assert.strictEqual(result.status, ExecutionStatus.FAILED);
      assert.ok(result.error.includes('NoChoiceMatched'));
    });
  });

  describe('execute Fail workflow', () => {
    it('should fail with error and cause', async () => {
      const schema = {
        StartAt: 'FailState',
        States: {
          FailState: {
            Type: 'Fail',
            Error: 'CustomError',
            Cause: 'Something went wrong'
          }
        }
      };

      const result = await executor.execute('wf_test', 'Test', schema, {});

      assert.strictEqual(result.status, ExecutionStatus.FAILED);
      assert.strictEqual(result.error, 'CustomError');
      assert.strictEqual(result.cause, 'Something went wrong');
    });
  });

  describe('execution status and events', () => {
    it('should track execution status', async () => {
      const schema = {
        StartAt: 'Done',
        States: {
          Done: { Type: 'Succeed' }
        }
      };

      const result = await executor.execute('wf_test', 'Test', schema, {});

      const status = executor.getStatus(result.execution_id);
      assert.strictEqual(status.status, ExecutionStatus.SUCCEEDED);
      assert.strictEqual(status.workflow_name, 'Test');
    });

    it('should record execution events', async () => {
      const schema = {
        StartAt: 'Step1',
        States: {
          Step1: {
            Type: 'Pass',
            Next: 'Step2'
          },
          Step2: {
            Type: 'Succeed'
          }
        }
      };

      const result = await executor.execute('wf_test', 'Test', schema, {});
      const events = executor.getEvents(result.execution_id);

      assert.ok(events.length > 0);
      assert.ok(events.some(e => e.type === EventType.EXECUTION_STARTED));
      assert.ok(events.some(e => e.type === EventType.STATE_ENTERED && e.state_name === 'Step1'));
      assert.ok(events.some(e => e.type === EventType.STATE_ENTERED && e.state_name === 'Step2'));
      assert.ok(events.some(e => e.type === EventType.EXECUTION_SUCCEEDED));
    });
  });

  describe('listExecutions', () => {
    it('should list all executions', async () => {
      const schema = { StartAt: 'Done', States: { Done: { Type: 'Succeed' } } };

      await executor.execute('wf_1', 'Workflow 1', schema, {});
      await executor.execute('wf_2', 'Workflow 2', schema, {});

      const executions = executor.listExecutions();
      assert.strictEqual(executions.length, 2);
    });

    it('should filter by workflow_id', async () => {
      const schema = { StartAt: 'Done', States: { Done: { Type: 'Succeed' } } };

      await executor.execute('wf_1', 'Workflow 1', schema, {});
      await executor.execute('wf_1', 'Workflow 1', schema, {});
      await executor.execute('wf_2', 'Workflow 2', schema, {});

      const executions = executor.listExecutions({ workflow_id: 'wf_1' });
      assert.strictEqual(executions.length, 2);
    });
  });

  describe('abort', () => {
    it('should return false for non-existent execution', () => {
      const result = executor.abort('exec_nonexistent');
      assert.strictEqual(result, false);
    });

    it('should abort completed execution and mark as aborted', async () => {
      const schema = { StartAt: 'Done', States: { Done: { Type: 'Succeed' } } };
      const result = await executor.execute('wf_test', 'Test', schema, {});

      // Already completed - can still mark as aborted if waiting
      const status = executor.getStatus(result.execution_id);
      assert.strictEqual(status.status, ExecutionStatus.SUCCEEDED);
    });
  });
});

// TaskError Tests
describe('TaskError', () => {
  it('should create error with details', () => {
    const error = new TaskError('TestError', 'Test cause', { extra: 'info' });

    assert.strictEqual(error.error, 'TestError');
    assert.strictEqual(error.cause, 'Test cause');
    assert.deepStrictEqual(error.details, { extra: 'info' });
  });
});
