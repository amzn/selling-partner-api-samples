/**
 * Tests for Builder module
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

import { WorkflowStore } from '../src/builder/workflow-store.js';
import {
  createTaskState,
  createChoiceState,
  createSucceedState,
  createFailState,
  createWaitState,
  createPassState
} from '../src/builder/state-factory.js';

describe('WorkflowStore', () => {
  let store;

  beforeEach(() => {
    store = new WorkflowStore();
  });

  describe('create', () => {
    it('should create a workflow with ID', () => {
      const result = store.create('Test Workflow', 'A test workflow');
      assert.ok(result.workflow_id.startsWith('wf_'));
      assert.strictEqual(result.name, 'Test Workflow');
    });

    it('should store the workflow', () => {
      const result = store.create('Test', '');
      const workflow = store.get(result.workflow_id);
      assert.ok(workflow);
      assert.strictEqual(workflow.name, 'Test');
    });
  });

  describe('addState', () => {
    it('should add a state to workflow', () => {
      const { workflow_id } = store.create('Test', '');
      const state = createSucceedState();
      const result = store.addState(workflow_id, 'Done', state);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.state_added, 'Done');
    });

    it('should auto-set StartAt for first state', () => {
      const { workflow_id } = store.create('Test', '');
      const state = createSucceedState();
      store.addState(workflow_id, 'First', state);
      const workflow = store.get(workflow_id);
      assert.strictEqual(workflow.start_at, 'First');
    });

    it('should reject duplicate state names', () => {
      const { workflow_id } = store.create('Test', '');
      store.addState(workflow_id, 'State1', createSucceedState());
      const result = store.addState(workflow_id, 'State1', createSucceedState());
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('already exists'));
    });

    it('should reject state names over 80 chars', () => {
      const { workflow_id } = store.create('Test', '');
      const longName = 'a'.repeat(81);
      const result = store.addState(workflow_id, longName, createSucceedState());
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('80 character'));
    });
  });

  describe('connectStates', () => {
    it('should connect two states', () => {
      const { workflow_id } = store.create('Test', '');
      store.addState(workflow_id, 'A', createPassState());
      store.addState(workflow_id, 'B', createSucceedState());
      const result = store.connectStates(workflow_id, 'A', 'B');
      assert.strictEqual(result.success, true);

      const schema = store.toASL(workflow_id);
      assert.strictEqual(schema.States.A.Next, 'B');
      assert.strictEqual(schema.States.A.End, undefined);
    });

    it('should reject connecting from terminal states', () => {
      const { workflow_id } = store.create('Test', '');
      store.addState(workflow_id, 'A', createSucceedState());
      store.addState(workflow_id, 'B', createSucceedState());
      const result = store.connectStates(workflow_id, 'A', 'B');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('terminal'));
    });
  });

  describe('setStartState', () => {
    it('should set the start state', () => {
      const { workflow_id } = store.create('Test', '');
      store.addState(workflow_id, 'A', createSucceedState());
      store.addState(workflow_id, 'B', createSucceedState());
      const result = store.setStartState(workflow_id, 'B');
      assert.strictEqual(result.success, true);

      const schema = store.toASL(workflow_id);
      assert.strictEqual(schema.StartAt, 'B');
    });
  });

  describe('removeState', () => {
    it('should remove a state', () => {
      const { workflow_id } = store.create('Test', '');
      store.addState(workflow_id, 'A', createSucceedState());
      const result = store.removeState(workflow_id, 'A');
      assert.strictEqual(result.success, true);

      const workflow = store.get(workflow_id);
      assert.strictEqual(workflow.states.size, 0);
    });

    it('should clear StartAt when removing start state', () => {
      const { workflow_id } = store.create('Test', '');
      store.addState(workflow_id, 'Start', createSucceedState());
      store.removeState(workflow_id, 'Start');

      const workflow = store.get(workflow_id);
      assert.strictEqual(workflow.start_at, null);
    });

    it('should remove references to deleted state', () => {
      const { workflow_id } = store.create('Test', '');
      store.addState(workflow_id, 'A', createPassState());
      store.addState(workflow_id, 'B', createSucceedState());
      store.connectStates(workflow_id, 'A', 'B');
      store.removeState(workflow_id, 'B');

      const schema = store.toASL(workflow_id);
      assert.strictEqual(schema.States.A.Next, undefined);
    });
  });

  describe('toASL', () => {
    it('should generate valid ASL schema', () => {
      const { workflow_id } = store.create('Test Workflow', 'Description');
      store.addState(workflow_id, 'Task1', createTaskState({
        path: '/fba/inventory/v1/summaries',
        queryParams: { sku: 'ABC' }
      }));
      store.addState(workflow_id, 'Done', createSucceedState());
      store.connectStates(workflow_id, 'Task1', 'Done');
      store.setStartState(workflow_id, 'Task1');

      const schema = store.toASL(workflow_id);

      assert.strictEqual(schema.Comment, 'Description');
      assert.strictEqual(schema.StartAt, 'Task1');
      assert.ok(schema.States.Task1);
      assert.ok(schema.States.Done);
      assert.strictEqual(schema.States.Task1.Type, 'Task');
      assert.strictEqual(schema.States.Task1.Next, 'Done');
      assert.strictEqual(schema.States.Done.Type, 'Succeed');
    });
  });

  describe('list', () => {
    it('should list all workflows', () => {
      store.create('Workflow1', '');
      store.create('Workflow2', '');
      const result = store.list();
      assert.strictEqual(result.workflows.length, 2);
    });
  });

  describe('delete', () => {
    it('should delete a workflow', () => {
      const { workflow_id } = store.create('Test', '');
      const result = store.delete(workflow_id);
      assert.strictEqual(result.success, true);
      assert.strictEqual(store.get(workflow_id), null);
    });
  });
});

describe('State Factory', () => {
  describe('createTaskState', () => {
    it('should create a Task state with full endpoint spec', () => {
      const state = createTaskState({
        method: 'GET',
        path: '/fba/inventory/v1/summaries',
        queryParams: {
          sellerSkus: ['SKU-123'],
          marketplaceIds: ['ATVPDKIKX0DER']
        }
      });

      assert.strictEqual(state.Type, 'Task');
      assert.strictEqual(state.Resource, 'sp-api');
      assert.strictEqual(state.Parameters.method, 'GET');
      assert.strictEqual(state.Parameters.path, '/fba/inventory/v1/summaries');
      assert.deepStrictEqual(state.Parameters.queryParams.sellerSkus, ['SKU-123']);
    });

    it('should process JSONPath parameters in queryParams', () => {
      const state = createTaskState({
        path: '/orders/v0/orders',
        queryParams: {
          orderId: '$.input.orderId'
        }
      });

      // $.input.orderId should become orderId.$ in queryParams
      assert.strictEqual(state.Parameters.queryParams['orderId.$'], '$.input.orderId');
    });

    it('should process JSONPath parameters in pathParams', () => {
      const state = createTaskState({
        path: '/orders/v0/orders/{orderId}',
        pathParams: {
          orderId: '$.input.orderId'
        }
      });

      assert.strictEqual(state.Parameters.pathParams['orderId.$'], '$.input.orderId');
    });

    it('should add retry policy', () => {
      const state = createTaskState({ path: '/test' }, {
        retry: { max_attempts: 5 }
      });

      assert.ok(state.Retry);
      assert.strictEqual(state.Retry[0].MaxAttempts, 5);
    });

    it('should add ResultPath', () => {
      const state = createTaskState({ path: '/test' }, {
        resultPath: '$.result'
      });

      assert.strictEqual(state.ResultPath, '$.result');
    });

    it('should include body for POST requests', () => {
      const state = createTaskState({
        method: 'POST',
        path: '/feeds/2021-06-30/feeds',
        body: {
          feedType: 'POST_PRODUCT_DATA',
          marketplaceIds: ['ATVPDKIKX0DER']
        }
      });

      assert.strictEqual(state.Parameters.method, 'POST');
      assert.deepStrictEqual(state.Parameters.body, {
        feedType: 'POST_PRODUCT_DATA',
        marketplaceIds: ['ATVPDKIKX0DER']
      });
    });
  });

  describe('createChoiceState', () => {
    it('should create a Choice state', () => {
      const state = createChoiceState([
        { variable: '$.count', comparison: 'NumericLessThan', value: 10, next: 'Low' }
      ], 'High');

      assert.strictEqual(state.Type, 'Choice');
      assert.strictEqual(state.Choices.length, 1);
      assert.strictEqual(state.Choices[0].Variable, '$.count');
      assert.strictEqual(state.Choices[0].NumericLessThan, 10);
      assert.strictEqual(state.Choices[0].Next, 'Low');
      assert.strictEqual(state.Default, 'High');
    });
  });

  describe('createSucceedState', () => {
    it('should create a Succeed state', () => {
      const state = createSucceedState();
      assert.strictEqual(state.Type, 'Succeed');
    });
  });

  describe('createFailState', () => {
    it('should create a Fail state with error and cause', () => {
      const state = createFailState('TestError', 'Test failed');
      assert.strictEqual(state.Type, 'Fail');
      assert.strictEqual(state.Error, 'TestError');
      assert.strictEqual(state.Cause, 'Test failed');
    });
  });

  describe('createWaitState', () => {
    it('should create a Wait state', () => {
      const state = createWaitState(30);
      assert.strictEqual(state.Type, 'Wait');
      assert.strictEqual(state.Seconds, 30);
    });
  });

  describe('createPassState', () => {
    it('should create a Pass state', () => {
      const state = createPassState({ key: 'value' }, '$.data');
      assert.strictEqual(state.Type, 'Pass');
      assert.deepStrictEqual(state.Result, { key: 'value' });
      assert.strictEqual(state.ResultPath, '$.data');
    });
  });
});
