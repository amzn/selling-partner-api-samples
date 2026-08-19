import { Router } from 'express';
import { validateInputValue } from '../../../src/schema/input-types/index.js';

export function createCallbackRoutes({ executor, callbackHandler }) {
  const router = Router();

  // Submit callback and auto-resume execution
  router.post('/:id/submit', async (req, res) => {
    const callbackId = req.params.id;
    const { approved = true, comment = '', data } = req.body;

    // Get the callback
    const callback = callbackHandler.getCallback(callbackId);
    if (!callback) {
      return res.status(404).json({ error: `Callback not found: ${callbackId}` });
    }

    if (callback.status !== 'PENDING') {
      return res.status(400).json({ error: `Callback already resolved: ${callback.status}` });
    }

    // Validate input if it's an Input callback
    if (callback.input_type && approved && data !== undefined) {
      const validation = validateInputValue(callback.input_type, data, callback.input_request);
      if (!validation.valid) {
        const msg = validation.error
          || (validation.errors ? JSON.stringify(validation.errors) : 'Validation failed');
        return res.status(400).json({ error: `Invalid input: ${msg}` });
      }
    }

    // Submit the callback
    const submitResult = callbackHandler.submitCallback(callbackId, approved, comment, data);
    if (!submitResult.success) {
      return res.status(400).json(submitResult);
    }

    // Auto-resume execution
    if (callback.execution_id) {
      try {
        const resumeResult = await executor.resume(callback.execution_id);
        return res.json(resumeResult);
      } catch (err) {
        return res.status(500).json({
          error: 'Resume failed',
          cause: err.message,
          callback_submitted: true,
        });
      }
    }

    res.json({ success: true, callback_id: callbackId });
  });

  return router;
}
