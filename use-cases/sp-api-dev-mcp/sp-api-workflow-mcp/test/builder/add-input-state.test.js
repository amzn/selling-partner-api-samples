/**
 * add_input_state Tool Tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { handleBuilderTool } from '../../src/builder/index.js';

describe('add_input_state tool', () => {
  let workflowId;

  beforeEach(async () => {
    // Create a fresh workflow for each test
    const result = await handleBuilderTool('create_workflow', {
      name: 'test-workflow'
    });
    workflowId = result.workflow_id;
  });

  describe('SingleSelect', () => {
    it('should add a SingleSelect Input state with options path', async () => {
      const result = await handleBuilderTool('add_input_state', {
        workflow_id: workflowId,
        state_name: 'SelectOption',
        input_type: 'SingleSelect',
        title: 'Select an Option',
        description: 'Choose one option from the list',
        result_path: '$.userSelection',
        config: {
          options_path: '$.availableOptions',
          option_label: 'name',
          option_value: 'id'
        }
      });

      assert.ok(result.success);

      // Verify the state was added correctly
      const schema = await handleBuilderTool('get_workflow_schema', {
        workflow_id: workflowId
      });

      const state = schema.States.SelectOption;
      assert.strictEqual(state.Type, 'Input');
      assert.strictEqual(state.InputType, 'SingleSelect');
      assert.strictEqual(state.Title, 'Select an Option');
      assert.strictEqual(state['Options.$'], '$.availableOptions');
      assert.strictEqual(state.OptionLabel, 'name');
      assert.strictEqual(state.OptionValue, 'id');
      assert.strictEqual(state.ResultPath, '$.userSelection');
    });

    it('should add a SingleSelect Input state with static options', async () => {
      const result = await handleBuilderTool('add_input_state', {
        workflow_id: workflowId,
        state_name: 'SelectPriority',
        input_type: 'SingleSelect',
        title: 'Select Priority',
        result_path: '$.priority',
        config: {
          options: [
            { id: 'low', name: 'Low Priority' },
            { id: 'medium', name: 'Medium Priority' },
            { id: 'high', name: 'High Priority' }
          ],
          option_label: 'name',
          option_value: 'id'
        }
      });

      assert.ok(result.success);

      const schema = await handleBuilderTool('get_workflow_schema', {
        workflow_id: workflowId
      });

      const state = schema.States.SelectPriority;
      assert.strictEqual(state.Options.length, 3);
    });
  });

  describe('Boolean', () => {
    it('should add a Boolean Input state', async () => {
      const result = await handleBuilderTool('add_input_state', {
        workflow_id: workflowId,
        state_name: 'ConfirmProceed',
        input_type: 'Boolean',
        title: 'Continue?',
        description: 'Do you want to proceed with this action?',
        result_path: '$.proceed',
        config: {
          true_label: 'Yes, continue',
          false_label: 'No, cancel'
        }
      });

      assert.ok(result.success);

      const schema = await handleBuilderTool('get_workflow_schema', {
        workflow_id: workflowId
      });

      const state = schema.States.ConfirmProceed;
      assert.strictEqual(state.Type, 'Input');
      assert.strictEqual(state.InputType, 'Boolean');
      assert.strictEqual(state.TrueLabel, 'Yes, continue');
      assert.strictEqual(state.FalseLabel, 'No, cancel');
    });
  });

  describe('Text', () => {
    it('should add a Text Input state with validation', async () => {
      const result = await handleBuilderTool('add_input_state', {
        workflow_id: workflowId,
        state_name: 'EnterNotes',
        input_type: 'Text',
        title: 'Enter Notes',
        result_path: '$.notes',
        config: {
          min_length: 10,
          max_length: 500,
          multiline: true,
          placeholder: 'Enter your notes here...'
        }
      });

      assert.ok(result.success);

      const schema = await handleBuilderTool('get_workflow_schema', {
        workflow_id: workflowId
      });

      const state = schema.States.EnterNotes;
      assert.strictEqual(state.InputType, 'Text');
      assert.strictEqual(state.MinLength, 10);
      assert.strictEqual(state.MaxLength, 500);
      assert.strictEqual(state.Multiline, true);
    });
  });

  describe('Number', () => {
    it('should add a Number Input state', async () => {
      const result = await handleBuilderTool('add_input_state', {
        workflow_id: workflowId,
        state_name: 'EnterQuantity',
        input_type: 'Number',
        title: 'Enter Quantity',
        result_path: '$.quantity',
        config: {
          min: 1,
          max: 1000,
          step: 10,
          unit: 'units'
        }
      });

      assert.ok(result.success);

      const schema = await handleBuilderTool('get_workflow_schema', {
        workflow_id: workflowId
      });

      const state = schema.States.EnterQuantity;
      assert.strictEqual(state.InputType, 'Number');
      assert.strictEqual(state.Min, 1);
      assert.strictEqual(state.Max, 1000);
      assert.strictEqual(state.Unit, 'units');
    });
  });

  describe('Confirm', () => {
    it('should add a Confirm Input state', async () => {
      const result = await handleBuilderTool('add_input_state', {
        workflow_id: workflowId,
        state_name: 'ConfirmShipment',
        input_type: 'Confirm',
        title: 'Confirm Shipment',
        description: 'Review and confirm the shipment details',
        result_path: '$.confirmation',
        config: {
          details_path: '$.shipmentSummary',
          warning_level: 'warning',
          warning_message: 'This action cannot be undone.',
          confirm_label: 'Create Shipment',
          cancel_label: 'Go Back'
        }
      });

      assert.ok(result.success);

      const schema = await handleBuilderTool('get_workflow_schema', {
        workflow_id: workflowId
      });

      const state = schema.States.ConfirmShipment;
      assert.strictEqual(state.InputType, 'Confirm');
      assert.strictEqual(state.WarningLevel, 'warning');
      assert.strictEqual(state.ConfirmLabel, 'Create Shipment');
    });
  });

  describe('Table', () => {
    it('should add a Table Input state', async () => {
      const result = await handleBuilderTool('add_input_state', {
        workflow_id: workflowId,
        state_name: 'SelectSKUs',
        input_type: 'Table',
        title: 'Select SKUs',
        result_path: '$.selectedSKUs',
        config: {
          data_path: '$.inventoryItems',
          columns: [
            { field: 'sku', header: 'SKU' },
            { field: 'name', header: 'Product Name' },
            { field: 'quantity', header: 'Qty', format: 'number' }
          ],
          multi_select: true,
          min_selections: 1,
          sortable: true
        }
      });

      assert.ok(result.success);

      const schema = await handleBuilderTool('get_workflow_schema', {
        workflow_id: workflowId
      });

      const state = schema.States.SelectSKUs;
      assert.strictEqual(state.InputType, 'Table');
      assert.strictEqual(state.Columns.length, 3);
      assert.strictEqual(state.MultiSelect, true);
    });
  });

  describe('validation', () => {
    it('should reject invalid input type', async () => {
      const result = await handleBuilderTool('add_input_state', {
        workflow_id: workflowId,
        state_name: 'InvalidState',
        input_type: 'InvalidType',
        title: 'Test',
        result_path: '$.test'
      });

      assert.ok(result.error);
    });

    it('should reject missing required fields', async () => {
      const result = await handleBuilderTool('add_input_state', {
        workflow_id: workflowId,
        state_name: 'MissingFields',
        input_type: 'SingleSelect',
        title: 'Test',
        result_path: '$.test'
        // Missing options or options_path
      });

      assert.ok(result.error || result.details);
    });

    it('should set default timeout', async () => {
      const result = await handleBuilderTool('add_input_state', {
        workflow_id: workflowId,
        state_name: 'DefaultTimeout',
        input_type: 'Boolean',
        title: 'Test',
        result_path: '$.test'
      });

      assert.ok(result.success);

      const schema = await handleBuilderTool('get_workflow_schema', {
        workflow_id: workflowId
      });

      assert.strictEqual(schema.States.DefaultTimeout.Timeout, 3600);
    });

    it('should set custom timeout', async () => {
      const result = await handleBuilderTool('add_input_state', {
        workflow_id: workflowId,
        state_name: 'CustomTimeout',
        input_type: 'Boolean',
        title: 'Test',
        result_path: '$.test',
        timeout: 7200
      });

      assert.ok(result.success);

      const schema = await handleBuilderTool('get_workflow_schema', {
        workflow_id: workflowId
      });

      assert.strictEqual(schema.States.CustomTimeout.Timeout, 7200);
    });
  });

  describe('connection', () => {
    it('should allow connecting Input state to next state', async () => {
      // Add Input state
      await handleBuilderTool('add_input_state', {
        workflow_id: workflowId,
        state_name: 'GetInput',
        input_type: 'Boolean',
        title: 'Continue?',
        result_path: '$.continue'
      });

      // Add a succeed state
      await handleBuilderTool('add_succeed_state', {
        workflow_id: workflowId,
        state_name: 'Done'
      });

      // Connect them
      const result = await handleBuilderTool('connect_states', {
        workflow_id: workflowId,
        from_state: 'GetInput',
        to_state: 'Done'
      });

      assert.ok(result.success);

      const schema = await handleBuilderTool('get_workflow_schema', {
        workflow_id: workflowId
      });

      assert.strictEqual(schema.States.GetInput.Next, 'Done');
      assert.strictEqual(schema.States.GetInput.End, undefined);
    });
  });
});
