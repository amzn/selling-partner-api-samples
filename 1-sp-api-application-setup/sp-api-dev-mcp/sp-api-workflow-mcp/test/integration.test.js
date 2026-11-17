/**
 * Integration Tests
 *
 * Tests end-to-end workflow building and execution
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

import { WorkflowStore } from '../src/builder/workflow-store.js';
import { createTaskState, createChoiceState, createSucceedState, createFailState, createPassState } from '../src/builder/state-factory.js';
import { WorkflowExecutor } from '../src/interpreter/executor.js';
import { CallbackHandler } from '../src/callback/callback-handler.js';
import { ExecutionStatus } from '../src/interpreter/execution-store.js';

describe('Integration Tests', () => {
  let store;
  let executor;
  let callbackHandler;

  beforeEach(() => {
    store = new WorkflowStore();
    callbackHandler = new CallbackHandler();
    executor = new WorkflowExecutor({
      callbackHandler
    });
  });

  describe('Simple Workflow E2E', () => {
    it('should build and execute a simple Pass workflow', async () => {
      // Build workflow
      const { workflow_id } = store.create('Test Workflow', 'A simple test workflow');

      const passState = createPassState({ message: 'Hello, World!' }, '$.result');
      store.addState(workflow_id, 'Start', passState);

      const succeedState = createSucceedState();
      store.addState(workflow_id, 'Done', succeedState);

      store.connectStates(workflow_id, 'Start', 'Done');
      store.setStartState(workflow_id, 'Start');

      // Validate
      const validation = store.validate(workflow_id);
      assert.strictEqual(validation.valid, true);

      // Get schema
      const schema = store.toASL(workflow_id);
      assert.strictEqual(schema.StartAt, 'Start');

      // Execute
      const result = await executor.execute(workflow_id, 'Test', schema, { input: 'data' });

      assert.strictEqual(result.status, ExecutionStatus.SUCCEEDED);
      assert.deepStrictEqual(result.output.result, { message: 'Hello, World!' });
    });

    it('should build and execute a workflow with Choice state', async () => {
      // Build workflow
      const { workflow_id } = store.create('Choice Workflow', 'Tests conditional branching');

      // Start with input evaluation
      const checkState = createChoiceState([
        { variable: '$.value', comparison: 'NumericGreaterThan', value: 50, next: 'High' }
      ], 'Low');
      store.addState(workflow_id, 'Check', checkState);

      // High path
      store.addState(workflow_id, 'High', createPassState({ level: 'HIGH' }, '$.result'));

      // Low path
      store.addState(workflow_id, 'Low', createPassState({ level: 'LOW' }, '$.result'));

      // Both paths end at Done
      store.addState(workflow_id, 'Done', createSucceedState());

      store.connectStates(workflow_id, 'High', 'Done');
      store.connectStates(workflow_id, 'Low', 'Done');
      store.setStartState(workflow_id, 'Check');

      // Get schema
      const schema = store.toASL(workflow_id);

      // Execute with high value
      const highResult = await executor.execute(workflow_id, 'Test', schema, { value: 75 });
      assert.strictEqual(highResult.status, ExecutionStatus.SUCCEEDED);
      assert.strictEqual(highResult.output.result.level, 'HIGH');

      // Execute with low value
      const lowResult = await executor.execute(workflow_id, 'Test', schema, { value: 25 });
      assert.strictEqual(lowResult.status, ExecutionStatus.SUCCEEDED);
      assert.strictEqual(lowResult.output.result.level, 'LOW');
    });

    it('should build and execute a workflow with Fail state', async () => {
      // Build workflow
      const { workflow_id } = store.create('Fail Workflow', 'Tests failure handling');

      const checkState = createChoiceState([
        { variable: '$.proceed', comparison: 'BooleanEquals', value: true, next: 'Success' }
      ], 'Failure');
      store.addState(workflow_id, 'Check', checkState);

      store.addState(workflow_id, 'Success', createSucceedState());
      store.addState(workflow_id, 'Failure', createFailState('ValidationError', 'Proceed was false'));

      store.setStartState(workflow_id, 'Check');

      const schema = store.toASL(workflow_id);

      // Execute with proceed=false
      const failResult = await executor.execute(workflow_id, 'Test', schema, { proceed: false });
      assert.strictEqual(failResult.status, ExecutionStatus.FAILED);
      assert.strictEqual(failResult.error, 'ValidationError');
    });
  });

  describe('Callback Workflow E2E', () => {
    it('should execute workflow with callback that gets approved', async () => {
      // Build workflow with callback
      const { workflow_id } = store.create('Approval Workflow', 'Tests callback handling');

      const callbackState = {
        Type: 'Task',
        Resource: 'callback',
        Parameters: {
          prompt: 'Please approve this request',
          details: {
            'amount.$': '$.amount'
          }
        },
        ResultPath: '$.approval',
        End: false
      };
      store.addState(workflow_id, 'GetApproval', callbackState);

      const checkApproval = createChoiceState([
        { variable: '$.approval.approved', comparison: 'BooleanEquals', value: true, next: 'Approved' }
      ], 'Rejected');
      store.addState(workflow_id, 'CheckApproval', checkApproval);

      store.addState(workflow_id, 'Approved', createPassState({ status: 'APPROVED' }, '$.result'));
      store.addState(workflow_id, 'Rejected', createPassState({ status: 'REJECTED' }, '$.result'));
      store.addState(workflow_id, 'Done', createSucceedState());

      store.connectStates(workflow_id, 'GetApproval', 'CheckApproval');
      store.connectStates(workflow_id, 'Approved', 'Done');
      store.connectStates(workflow_id, 'Rejected', 'Done');
      store.setStartState(workflow_id, 'GetApproval');

      const schema = store.toASL(workflow_id);

      // Start execution in background and approve callback
      const executePromise = executor.execute(workflow_id, 'Test', schema, { amount: 100 });

      // Wait a bit for callback to be created
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get pending callbacks and approve
      const pending = callbackHandler.listPending();
      assert.strictEqual(pending.length, 1);

      callbackHandler.submitCallback(pending[0].id, true, 'Looks good');

      // Wait for execution to complete
      const result = await executePromise;

      assert.strictEqual(result.status, ExecutionStatus.SUCCEEDED);
      assert.strictEqual(result.output.result.status, 'APPROVED');
      assert.strictEqual(result.output.approval.approved, true);
    });

    it('should execute workflow with callback that gets rejected', async () => {
      const { workflow_id } = store.create('Rejection Workflow', 'Tests callback rejection');

      const callbackState = {
        Type: 'Task',
        Resource: 'callback',
        Parameters: {
          prompt: 'Please approve this request'
        },
        ResultPath: '$.approval',
        End: false
      };
      store.addState(workflow_id, 'GetApproval', callbackState);

      const checkApproval = createChoiceState([
        { variable: '$.approval.approved', comparison: 'BooleanEquals', value: true, next: 'Approved' }
      ], 'Rejected');
      store.addState(workflow_id, 'CheckApproval', checkApproval);

      store.addState(workflow_id, 'Approved', createSucceedState());
      store.addState(workflow_id, 'Rejected', createFailState('RejectionError', 'Request was rejected'));

      store.connectStates(workflow_id, 'GetApproval', 'CheckApproval');
      store.setStartState(workflow_id, 'GetApproval');

      const schema = store.toASL(workflow_id);

      // Start execution and reject
      const executePromise = executor.execute(workflow_id, 'Test', schema, {});

      await new Promise(resolve => setTimeout(resolve, 50));

      const pending = callbackHandler.listPending();
      callbackHandler.submitCallback(pending[0].id, false, 'Not approved');

      const result = await executePromise;

      assert.strictEqual(result.status, ExecutionStatus.FAILED);
      assert.strictEqual(result.error, 'RejectionError');
    });
  });

  describe('Complex Workflow E2E', () => {
    it('should execute multi-step workflow with data transformation', async () => {
      const { workflow_id } = store.create('Data Pipeline', 'Multi-step data transformation');

      // Step 1: Initialize
      store.addState(workflow_id, 'Initialize', createPassState({ step: 1 }, '$.status'));

      // Step 2: Transform
      const transformState = {
        Type: 'Pass',
        Result: { transformed: true },
        ResultPath: '$.data',
        End: false
      };
      store.addState(workflow_id, 'Transform', transformState);

      // Step 3: Validate
      const validateState = createChoiceState([
        { variable: '$.data.transformed', comparison: 'BooleanEquals', value: true, next: 'Finalize' }
      ], 'Error');
      store.addState(workflow_id, 'Validate', validateState);

      // Step 4: Finalize
      store.addState(workflow_id, 'Finalize', createPassState({ step: 4, complete: true }, '$.status'));

      // Step 5: Done
      store.addState(workflow_id, 'Done', createSucceedState());

      // Error path
      store.addState(workflow_id, 'Error', createFailState('TransformError', 'Data transformation failed'));

      // Connect all states
      store.connectStates(workflow_id, 'Initialize', 'Transform');
      store.connectStates(workflow_id, 'Transform', 'Validate');
      store.connectStates(workflow_id, 'Finalize', 'Done');
      store.setStartState(workflow_id, 'Initialize');

      const schema = store.toASL(workflow_id);

      // Execute
      const result = await executor.execute(workflow_id, 'Test', schema, { input: 'data' });

      assert.strictEqual(result.status, ExecutionStatus.SUCCEEDED);
      assert.strictEqual(result.output.status.complete, true);
      assert.strictEqual(result.output.data.transformed, true);
    });
  });

  describe('Execution Tracking', () => {
    it('should track execution events correctly', async () => {
      const { workflow_id } = store.create('Tracked Workflow', '');

      store.addState(workflow_id, 'Step1', createPassState());
      store.addState(workflow_id, 'Step2', createPassState());
      store.addState(workflow_id, 'Done', createSucceedState());

      store.connectStates(workflow_id, 'Step1', 'Step2');
      store.connectStates(workflow_id, 'Step2', 'Done');
      store.setStartState(workflow_id, 'Step1');

      const schema = store.toASL(workflow_id);
      const result = await executor.execute(workflow_id, 'Test', schema, {});

      // Get events
      const events = executor.getEvents(result.execution_id);

      // Should have events for each state
      const stateEnteredEvents = events.filter(e => e.type === 'StateEntered');
      assert.strictEqual(stateEnteredEvents.length, 3); // Step1, Step2, Done

      const stateExitedEvents = events.filter(e => e.type === 'StateExited');
      assert.strictEqual(stateExitedEvents.length, 3);

      // Check event order
      const stateNames = stateEnteredEvents.map(e => e.state_name);
      assert.deepStrictEqual(stateNames, ['Step1', 'Step2', 'Done']);
    });

    it('should list executions with filters', async () => {
      const { workflow_id: wf1 } = store.create('Workflow 1', '');
      const { workflow_id: wf2 } = store.create('Workflow 2', '');

      store.addState(wf1, 'Done', createSucceedState());
      store.addState(wf2, 'Done', createSucceedState());
      store.setStartState(wf1, 'Done');
      store.setStartState(wf2, 'Done');

      const schema1 = store.toASL(wf1);
      const schema2 = store.toASL(wf2);

      await executor.execute(wf1, 'Workflow 1', schema1, {});
      await executor.execute(wf1, 'Workflow 1', schema1, {});
      await executor.execute(wf2, 'Workflow 2', schema2, {});

      // List all
      const all = executor.listExecutions();
      assert.strictEqual(all.length, 3);

      // Filter by workflow
      const wf1Executions = executor.listExecutions({ workflow_id: wf1 });
      assert.strictEqual(wf1Executions.length, 2);

      // Filter by status
      const succeeded = executor.listExecutions({ status: ExecutionStatus.SUCCEEDED });
      assert.strictEqual(succeeded.length, 3);
    });
  });
});
