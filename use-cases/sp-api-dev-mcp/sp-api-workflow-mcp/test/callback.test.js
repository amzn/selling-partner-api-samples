/**
 * Tests for Callback module
 */

import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert';

import { CallbackStore, CallbackStatus } from '../src/callback/callback-store.js';
import { CallbackHandler } from '../src/callback/callback-handler.js';
import { formatCallback, formatCallbackList } from '../src/callback/notifiers/console.js';

// CallbackStore Tests
describe('CallbackStore', () => {
  let store;

  beforeEach(() => {
    store = new CallbackStore();
  });

  after(() => {
    store.clear();
  });

  describe('create', () => {
    it('should create callback with ID', () => {
      const callback = store.create('exec_123', 'ApprovalState', 'Please approve');

      assert.ok(callback.id.startsWith('cb_'));
      assert.strictEqual(callback.execution_id, 'exec_123');
      assert.strictEqual(callback.state_name, 'ApprovalState');
      assert.strictEqual(callback.prompt, 'Please approve');
      assert.strictEqual(callback.status, CallbackStatus.PENDING);
    });

    it('should store details', () => {
      const callback = store.create('exec_123', 'State1', 'Prompt', {
        details: { amount: 100, item: 'Widget' }
      });

      assert.deepStrictEqual(callback.details, { amount: 100, item: 'Widget' });
    });

    it('should calculate expiry time', () => {
      const callback = store.create('exec_123', 'State1', 'Prompt', {
        timeoutSeconds: 300
      });

      assert.ok(callback.expires_at);
      const expiresAt = new Date(callback.expires_at);
      const now = Date.now();
      const diff = expiresAt.getTime() - now;

      // Should expire in about 300 seconds
      assert.ok(diff > 290000 && diff <= 300000);
    });

    it('should set default channels', () => {
      const callback = store.create('exec_123', 'State1', 'Prompt');
      assert.deepStrictEqual(callback.channels, ['console']);
    });
  });

  describe('get', () => {
    it('should get callback by ID', () => {
      const created = store.create('exec_123', 'State1', 'Prompt');
      const fetched = store.get(created.id);

      assert.strictEqual(fetched.id, created.id);
    });

    it('should return null for unknown ID', () => {
      const result = store.get('cb_unknown');
      assert.strictEqual(result, null);
    });
  });

  describe('resolve', () => {
    it('should resolve callback with approval', () => {
      const { id } = store.create('exec_123', 'State1', 'Prompt');

      const result = store.resolve(id, { approved: true, comment: 'Looks good' });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, CallbackStatus.APPROVED);

      const callback = store.get(id);
      assert.strictEqual(callback.status, CallbackStatus.APPROVED);
      assert.strictEqual(callback.response.approved, true);
      assert.ok(callback.resolved_at);
    });

    it('should resolve callback with rejection', () => {
      const { id } = store.create('exec_123', 'State1', 'Prompt');

      const result = store.resolve(id, { approved: false, comment: 'Not approved' });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, CallbackStatus.REJECTED);
    });

    it('should fail for unknown callback', () => {
      const result = store.resolve('cb_unknown', { approved: true });

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('not found'));
    });

    it('should fail for already resolved callback', () => {
      const { id } = store.create('exec_123', 'State1', 'Prompt');
      store.resolve(id, { approved: true });

      const result = store.resolve(id, { approved: false });

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('already resolved'));
    });
  });

  describe('waitForResolution', () => {
    it('should resolve immediately if already resolved', async () => {
      const { id } = store.create('exec_123', 'State1', 'Prompt');
      store.resolve(id, { approved: true, data: { key: 'value' } });

      const response = await store.waitForResolution(id);

      assert.strictEqual(response.approved, true);
      assert.deepStrictEqual(response.data, { key: 'value' });
    });

    it('should wait for resolution', async () => {
      const { id } = store.create('exec_123', 'State1', 'Prompt');

      // Resolve after a short delay
      setTimeout(() => {
        store.resolve(id, { approved: true });
      }, 50);

      const response = await store.waitForResolution(id);

      assert.strictEqual(response.approved, true);
    });

    it('should reject for unknown callback', async () => {
      await assert.rejects(
        store.waitForResolution('cb_unknown'),
        /not found/
      );
    });
  });

  describe('cancel', () => {
    it('should cancel pending callback', () => {
      const { id } = store.create('exec_123', 'State1', 'Prompt');

      const result = store.cancel(id);

      assert.strictEqual(result.success, true);

      const callback = store.get(id);
      assert.strictEqual(callback.status, CallbackStatus.CANCELLED);
    });

    it('should fail for already resolved', () => {
      const { id } = store.create('exec_123', 'State1', 'Prompt');
      store.resolve(id, { approved: true });

      const result = store.cancel(id);

      assert.strictEqual(result.success, false);
    });
  });

  describe('extendTimeout', () => {
    it('should extend timeout', () => {
      const { id } = store.create('exec_123', 'State1', 'Prompt', {
        timeoutSeconds: 60
      });

      const callback = store.get(id);
      const originalExpiry = new Date(callback.expires_at).getTime();

      const result = store.extendTimeout(id, 120);

      assert.strictEqual(result.success, true);

      const updated = store.get(id);
      const newExpiry = new Date(updated.expires_at).getTime();

      // New expiry should be ~120 seconds later
      assert.ok(newExpiry - originalExpiry >= 118000);
    });
  });

  describe('list', () => {
    it('should list all callbacks', () => {
      store.create('exec_1', 'State1', 'Prompt 1');
      store.create('exec_2', 'State2', 'Prompt 2');

      const results = store.list();
      assert.strictEqual(results.length, 2);
    });

    it('should filter by execution_id', () => {
      store.create('exec_1', 'State1', 'Prompt 1');
      store.create('exec_1', 'State2', 'Prompt 2');
      store.create('exec_2', 'State3', 'Prompt 3');

      const results = store.list({ execution_id: 'exec_1' });
      assert.strictEqual(results.length, 2);
    });

    it('should filter by status', () => {
      const { id } = store.create('exec_1', 'State1', 'Prompt 1');
      store.create('exec_2', 'State2', 'Prompt 2');
      store.resolve(id, { approved: true });

      const pending = store.list({ status: CallbackStatus.PENDING });
      assert.strictEqual(pending.length, 1);

      const approved = store.list({ status: CallbackStatus.APPROVED });
      assert.strictEqual(approved.length, 1);
    });

    it('should apply limit', () => {
      store.create('exec_1', 'State1', 'Prompt 1');
      store.create('exec_2', 'State2', 'Prompt 2');
      store.create('exec_3', 'State3', 'Prompt 3');

      const results = store.list({ limit: 2 });
      assert.strictEqual(results.length, 2);
    });
  });

  describe('getPending', () => {
    it('should return only pending callbacks', () => {
      const { id } = store.create('exec_1', 'State1', 'Prompt 1');
      store.create('exec_2', 'State2', 'Prompt 2');
      store.resolve(id, { approved: true });

      const pending = store.getPending();
      assert.strictEqual(pending.length, 1);
      assert.strictEqual(pending[0].execution_id, 'exec_2');
    });
  });
});

// CallbackHandler Tests
describe('CallbackHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new CallbackHandler();
  });

  after(() => {
    handler.clear();
  });

  describe('createCallback', () => {
    it('should create and return callback', async () => {
      const callback = await handler.createCallback(
        'exec_123',
        'ApprovalState',
        'Please review and approve',
        { details: { order: 'ORD-123' } }
      );

      assert.ok(callback.id.startsWith('cb_'));
      assert.strictEqual(callback.prompt, 'Please review and approve');
    });
  });

  describe('submitCallback', () => {
    it('should submit approval', async () => {
      const callback = await handler.createCallback('exec_123', 'State1', 'Prompt');

      const result = handler.submitCallback(callback.id, true, 'Approved');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, CallbackStatus.APPROVED);
    });

    it('should submit rejection', async () => {
      const callback = await handler.createCallback('exec_123', 'State1', 'Prompt');

      const result = handler.submitCallback(callback.id, false, 'Rejected');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, CallbackStatus.REJECTED);
    });
  });

  describe('waitForCallback', () => {
    it('should wait and receive response', async () => {
      const callback = await handler.createCallback('exec_123', 'State1', 'Prompt');

      // Submit after delay
      setTimeout(() => {
        handler.submitCallback(callback.id, true, 'Done');
      }, 50);

      const response = await handler.waitForCallback(callback.id);

      assert.strictEqual(response.approved, true);
      assert.strictEqual(response.comment, 'Done');
    });
  });

  describe('listPending', () => {
    it('should list pending callbacks', async () => {
      await handler.createCallback('exec_1', 'State1', 'Prompt 1');
      await handler.createCallback('exec_2', 'State2', 'Prompt 2');

      const pending = handler.listPending();
      assert.strictEqual(pending.length, 2);
    });
  });
});

// Notifier Tests
describe('Console Notifier', () => {
  describe('formatCallback', () => {
    it('should format callback for display', () => {
      const callback = {
        id: 'cb_test123',
        status: CallbackStatus.PENDING,
        prompt: 'Please approve this request',
        execution_id: 'exec_456',
        state_name: 'ApprovalState',
        created_at: '2024-01-01T12:00:00Z'
      };

      const formatted = formatCallback(callback);

      assert.ok(formatted.includes('cb_test123'));
      assert.ok(formatted.includes('PENDING'));
      assert.ok(formatted.includes('Please approve this request'));
    });
  });

  describe('formatCallbackList', () => {
    it('should format empty list', () => {
      const formatted = formatCallbackList([]);
      assert.ok(formatted.includes('No pending callbacks'));
    });

    it('should format list with items', () => {
      const callbacks = [
        {
          id: 'cb_1',
          status: CallbackStatus.PENDING,
          prompt: 'First callback',
          created_at: '2024-01-01T12:00:00Z'
        },
        {
          id: 'cb_2',
          status: CallbackStatus.PENDING,
          prompt: 'Second callback',
          created_at: '2024-01-01T12:01:00Z'
        }
      ];

      const formatted = formatCallbackList(callbacks);

      assert.ok(formatted.includes('cb_1'));
      assert.ok(formatted.includes('cb_2'));
      assert.ok(formatted.includes('First callback'));
      assert.ok(formatted.includes('Second callback'));
    });
  });
});
