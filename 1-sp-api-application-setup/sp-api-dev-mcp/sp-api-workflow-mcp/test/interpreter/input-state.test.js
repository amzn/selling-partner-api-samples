/**
 * Input State Execution Tests
 *
 * Tests for synchronous pause/resume execution pattern.
 * When hitting an Input state, execute() returns immediately with WAITING_FOR_CALLBACK.
 * After setting up the callback response, resume() continues execution.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { WorkflowExecutor } from '../../src/interpreter/executor.js';

// Mock callback handler for synchronous pause/resume pattern
class MockCallbackHandler {
  constructor() {
    this.callbacks = new Map();
    this.callbackIdCounter = 0;
  }

  async createCallback(executionId, stateName, prompt, options) {
    const id = `cb_mock_${++this.callbackIdCounter}`;
    this.callbacks.set(id, {
      id,
      executionId,
      stateName,
      prompt,
      options,
      status: 'PENDING',
      response: null
    });
    return { id };
  }

  // Get callback by ID (used by executor.resume())
  getCallback(callbackId) {
    return this.callbacks.get(callbackId) || null;
  }

  // Set response for a callback (simulates submit_callback)
  submitResponse(callbackId, response) {
    const callback = this.callbacks.get(callbackId);
    if (callback) {
      callback.status = 'RESOLVED';
      callback.response = response;
    }
  }

  getLastCallback() {
    const entries = Array.from(this.callbacks.entries());
    if (entries.length === 0) return null;
    return entries[entries.length - 1][1];
  }
}

describe('Input State Execution', () => {
  let executor;
  let mockCallbackHandler;

  beforeEach(() => {
    mockCallbackHandler = new MockCallbackHandler();
    executor = new WorkflowExecutor({
      callbackHandler: mockCallbackHandler
    });
  });

  describe('SingleSelect Input', () => {
    it('should execute SingleSelect Input state and return user selection', async () => {
      const schema = {
        StartAt: 'SelectOption',
        States: {
          SelectOption: {
            Type: 'Input',
            InputType: 'SingleSelect',
            Title: 'Select an Option',
            Options: [
              { id: 'opt1', name: 'Option 1' },
              { id: 'opt2', name: 'Option 2' }
            ],
            OptionLabel: 'name',
            OptionValue: 'id',
            ResultPath: '$.selectedOption',
            Next: 'Done'
          },
          Done: {
            Type: 'Succeed'
          }
        }
      };

      // Execute - should pause at Input state
      const pauseResult = await executor.execute('wf_1', 'test', schema, { existing: 'data' });
      assert.strictEqual(pauseResult.status, 'WAITING_FOR_CALLBACK');
      assert.ok(pauseResult.callback_id);
      assert.ok(pauseResult.input_request);

      // Verify callback was created with correct options
      const callback = mockCallbackHandler.getLastCallback();
      assert.strictEqual(callback.options.inputType, 'SingleSelect');
      assert.strictEqual(callback.options.inputRequest.title, 'Select an Option');
      assert.strictEqual(callback.options.inputRequest.options.length, 2);

      // Submit callback response
      mockCallbackHandler.submitResponse(pauseResult.callback_id, {
        approved: true,
        data: 'opt1'
      });

      // Resume execution
      const result = await executor.resume(pauseResult.execution_id);

      assert.strictEqual(result.status, 'SUCCEEDED');
      assert.strictEqual(result.output.selectedOption, 'opt1');
      assert.strictEqual(result.output.existing, 'data');
    });

    it('should resolve dynamic options using JSONPath', async () => {
      const schema = {
        StartAt: 'SelectOption',
        States: {
          SelectOption: {
            Type: 'Input',
            InputType: 'SingleSelect',
            Title: 'Select Packing Option',
            'Options.$': '$.packingOptions.options',
            OptionLabel: 'description',
            ResultPath: '$.selectedPacking',
            End: true
          }
        }
      };

      const input = {
        packingOptions: {
          options: [
            { id: 'PO1', description: 'Ship in original boxes' },
            { id: 'PO2', description: 'Repack into Amazon boxes' }
          ]
        }
      };

      // Execute - should pause at Input state
      const pauseResult = await executor.execute('wf_1', 'test', schema, input);
      assert.strictEqual(pauseResult.status, 'WAITING_FOR_CALLBACK');

      // Verify dynamic options were resolved
      const callback = mockCallbackHandler.getLastCallback();
      assert.strictEqual(callback.options.inputRequest.options.length, 2);
      assert.strictEqual(callback.options.inputRequest.options[0].id, 'PO1');

      // Submit and resume
      mockCallbackHandler.submitResponse(pauseResult.callback_id, {
        approved: true,
        data: { id: 'PO1', description: 'Ship in original boxes' }
      });

      const result = await executor.resume(pauseResult.execution_id);
      assert.strictEqual(result.status, 'SUCCEEDED');
    });
  });

  describe('Boolean Input', () => {
    it('should execute Boolean Input state', async () => {
      const schema = {
        StartAt: 'Confirm',
        States: {
          Confirm: {
            Type: 'Input',
            InputType: 'Boolean',
            Title: 'Continue?',
            TrueLabel: 'Yes, proceed',
            FalseLabel: 'No, cancel',
            ResultPath: '$.userConfirmed',
            End: true
          }
        }
      };

      // Execute - pauses at Input
      const pauseResult = await executor.execute('wf_1', 'test', schema, {});
      assert.strictEqual(pauseResult.status, 'WAITING_FOR_CALLBACK');

      // Submit and resume
      mockCallbackHandler.submitResponse(pauseResult.callback_id, {
        approved: true,
        data: true
      });

      const result = await executor.resume(pauseResult.execution_id);

      assert.strictEqual(result.status, 'SUCCEEDED');
      assert.strictEqual(result.output.userConfirmed, true);
    });
  });

  describe('Text Input', () => {
    it('should execute Text Input state', async () => {
      const schema = {
        StartAt: 'EnterNotes',
        States: {
          EnterNotes: {
            Type: 'Input',
            InputType: 'Text',
            Title: 'Enter Notes',
            MinLength: 10,
            MaxLength: 500,
            Multiline: true,
            ResultPath: '$.notes',
            End: true
          }
        }
      };

      // Execute - pauses at Input
      const pauseResult = await executor.execute('wf_1', 'test', schema, {});
      assert.strictEqual(pauseResult.status, 'WAITING_FOR_CALLBACK');

      // Submit and resume
      mockCallbackHandler.submitResponse(pauseResult.callback_id, {
        approved: true,
        data: 'These are my notes for the shipment.'
      });

      const result = await executor.resume(pauseResult.execution_id);

      assert.strictEqual(result.status, 'SUCCEEDED');
      assert.strictEqual(result.output.notes, 'These are my notes for the shipment.');
    });
  });

  describe('Number Input', () => {
    it('should execute Number Input state', async () => {
      const schema = {
        StartAt: 'EnterQuantity',
        States: {
          EnterQuantity: {
            Type: 'Input',
            InputType: 'Number',
            Title: 'Enter Quantity',
            Min: 1,
            Max: 1000,
            Unit: 'units',
            ResultPath: '$.quantity',
            End: true
          }
        }
      };

      // Execute - pauses at Input
      const pauseResult = await executor.execute('wf_1', 'test', schema, {});
      assert.strictEqual(pauseResult.status, 'WAITING_FOR_CALLBACK');

      // Submit and resume
      mockCallbackHandler.submitResponse(pauseResult.callback_id, {
        approved: true,
        data: 150
      });

      const result = await executor.resume(pauseResult.execution_id);

      assert.strictEqual(result.status, 'SUCCEEDED');
      assert.strictEqual(result.output.quantity, 150);
    });
  });

  describe('Table Input', () => {
    it('should execute Table Input state with dynamic data', async () => {
      const schema = {
        StartAt: 'SelectSKUs',
        States: {
          SelectSKUs: {
            Type: 'Input',
            InputType: 'Table',
            Title: 'Select SKUs to Replenish',
            'Data.$': '$.inventory.lowStock',
            Columns: [
              { Field: 'sku', Header: 'SKU' },
              { Field: 'name', Header: 'Product' },
              { Field: 'qty', Header: 'Quantity', Format: 'number' }
            ],
            MultiSelect: true,
            MinSelections: 1,
            ResultPath: '$.selectedSKUs',
            End: true
          }
        }
      };

      const input = {
        inventory: {
          lowStock: [
            { sku: 'SKU-001', name: 'Widget A', qty: 5 },
            { sku: 'SKU-002', name: 'Widget B', qty: 3 },
            { sku: 'SKU-003', name: 'Widget C', qty: 8 }
          ]
        }
      };

      // Execute - pauses at Input
      const pauseResult = await executor.execute('wf_1', 'test', schema, input);
      assert.strictEqual(pauseResult.status, 'WAITING_FOR_CALLBACK');

      // Verify data was resolved from JSONPath
      const callback = mockCallbackHandler.getLastCallback();
      assert.strictEqual(callback.options.inputRequest.data.length, 3);

      // Submit and resume
      mockCallbackHandler.submitResponse(pauseResult.callback_id, {
        approved: true,
        data: [
          { sku: 'SKU-001', name: 'Widget A', qty: 5 },
          { sku: 'SKU-002', name: 'Widget B', qty: 3 }
        ]
      });

      const result = await executor.resume(pauseResult.execution_id);

      assert.strictEqual(result.status, 'SUCCEEDED');
      assert.strictEqual(result.output.selectedSKUs.length, 2);
    });
  });

  describe('Confirm Input', () => {
    it('should execute Confirm Input state with dynamic details', async () => {
      const schema = {
        StartAt: 'ConfirmShipment',
        States: {
          ConfirmShipment: {
            Type: 'Input',
            InputType: 'Confirm',
            Title: 'Confirm Shipment',
            'Details.$': '$.shipmentSummary',
            WarningLevel: 'warning',
            ConfirmLabel: 'Create Shipment',
            CancelLabel: 'Go Back',
            ResultPath: '$.confirmation',
            End: true
          }
        }
      };

      const input = {
        shipmentSummary: {
          destination: 'FBA Warehouse',
          items: 5,
          totalUnits: 150
        }
      };

      // Execute - pauses at Input
      const pauseResult = await executor.execute('wf_1', 'test', schema, input);
      assert.strictEqual(pauseResult.status, 'WAITING_FOR_CALLBACK');

      // Verify details were resolved
      const callback = mockCallbackHandler.getLastCallback();
      assert.strictEqual(callback.options.inputRequest.details.destination, 'FBA Warehouse');

      // Submit and resume
      mockCallbackHandler.submitResponse(pauseResult.callback_id, {
        approved: true,
        data: true
      });

      const result = await executor.resume(pauseResult.execution_id);
      assert.strictEqual(result.status, 'SUCCEEDED');
    });
  });

  describe('Input cancellation', () => {
    it('should fail workflow when user cancels Input', async () => {
      const schema = {
        StartAt: 'GetInput',
        States: {
          GetInput: {
            Type: 'Input',
            InputType: 'Boolean',
            Title: 'Continue?',
            ResultPath: '$.continue',
            End: true
          }
        }
      };

      // Execute - pauses at Input
      const pauseResult = await executor.execute('wf_1', 'test', schema, {});
      assert.strictEqual(pauseResult.status, 'WAITING_FOR_CALLBACK');

      // Submit rejection (user cancelled)
      mockCallbackHandler.submitResponse(pauseResult.callback_id, {
        approved: false
      });

      // Resume - should fail
      const result = await executor.resume(pauseResult.execution_id);

      assert.strictEqual(result.status, 'FAILED');
      assert.strictEqual(result.error, 'InputCancelled');
    });
  });

  describe('execution status', () => {
    it('should mark execution as WAITING_FOR_CALLBACK during Input', async () => {
      const schema = {
        StartAt: 'GetInput',
        States: {
          GetInput: {
            Type: 'Input',
            InputType: 'Text',
            Title: 'Enter text',
            ResultPath: '$.text',
            End: true
          }
        }
      };

      // Execute - returns immediately with WAITING_FOR_CALLBACK
      const pauseResult = await executor.execute('wf_1', 'test', schema, {});

      // Check status is WAITING_FOR_CALLBACK
      assert.strictEqual(pauseResult.status, 'WAITING_FOR_CALLBACK');

      // Also verify via getStatus
      const status = executor.getStatus(pauseResult.execution_id);
      assert.strictEqual(status.status, 'WAITING_FOR_CALLBACK');
    });
  });

  describe('workflow with multiple Input states', () => {
    it('should execute workflow with multiple Input states in sequence', async () => {
      const schema = {
        StartAt: 'SelectCategory',
        States: {
          SelectCategory: {
            Type: 'Input',
            InputType: 'SingleSelect',
            Title: 'Select Category',
            Options: [
              { id: 'electronics', name: 'Electronics' },
              { id: 'clothing', name: 'Clothing' }
            ],
            OptionLabel: 'name',
            OptionValue: 'id',
            ResultPath: '$.category',
            Next: 'EnterQuantity'
          },
          EnterQuantity: {
            Type: 'Input',
            InputType: 'Number',
            Title: 'Enter Quantity',
            Min: 1,
            Max: 100,
            ResultPath: '$.quantity',
            Next: 'ConfirmOrder'
          },
          ConfirmOrder: {
            Type: 'Input',
            InputType: 'Confirm',
            Title: 'Confirm Order',
            ResultPath: '$.confirmed',
            End: true
          }
        }
      };

      // First Input: SelectCategory
      let result = await executor.execute('wf_1', 'test', schema, {});
      assert.strictEqual(result.status, 'WAITING_FOR_CALLBACK');
      let executionId = result.execution_id;

      mockCallbackHandler.submitResponse(result.callback_id, {
        approved: true,
        data: 'electronics'
      });

      // Resume - should pause at second Input
      result = await executor.resume(executionId);
      assert.strictEqual(result.status, 'WAITING_FOR_CALLBACK');

      mockCallbackHandler.submitResponse(result.callback_id, {
        approved: true,
        data: 50
      });

      // Resume - should pause at third Input
      result = await executor.resume(executionId);
      assert.strictEqual(result.status, 'WAITING_FOR_CALLBACK');

      mockCallbackHandler.submitResponse(result.callback_id, {
        approved: true,
        data: true
      });

      // Resume - should complete
      result = await executor.resume(executionId);
      assert.strictEqual(result.status, 'SUCCEEDED');
      assert.strictEqual(result.output.category, 'electronics');
      assert.strictEqual(result.output.quantity, 50);
      assert.strictEqual(result.output.confirmed, true);
    });
  });
});
