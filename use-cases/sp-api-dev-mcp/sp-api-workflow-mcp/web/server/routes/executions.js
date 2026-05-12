import { Router } from 'express';

export function createExecutionRoutes({ workflowStore, executor, callbackHandler }) {
  const router = Router();

  // List executions
  router.get('/', (req, res) => {
    const executions = executor.listExecutions({
      workflow_id: req.query.workflow_id,
      status: req.query.status,
      limit: parseInt(req.query.limit) || 20,
    });
    res.json({ executions });
  });

  // Start a new execution
  router.post('/', async (req, res) => {
    const { workflow_id, input = {} } = req.body;
    if (!workflow_id) {
      return res.status(400).json({ error: 'workflow_id is required' });
    }

    const workflow = workflowStore.get(workflow_id);
    if (!workflow) {
      return res.status(404).json({ error: `Workflow not found: ${workflow_id}` });
    }

    const schema = workflowStore.toASL(workflow_id);

    try {
      const result = await executor.execute(workflow_id, workflow.name, schema, input);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get execution status (enriched with input_request when paused)
  router.get('/:id', (req, res) => {
    const status = executor.getStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ error: `Execution not found: ${req.params.id}` });
    }

    // Enrich with callback/input_request when waiting
    if (status.status === 'WAITING_FOR_CALLBACK') {
      const execution = executor.executionStore.get(req.params.id);
      if (execution && execution.pause_state) {
        const callback = callbackHandler.getCallback(execution.pause_state.callback_id);
        if (callback) {
          status.callback_id = execution.pause_state.callback_id;
          status.input_request = callback.input_request;
        }
      }
    }

    res.json(status);
  });

  // Get execution events
  router.get('/:id/events', (req, res) => {
    const events = executor.getEvents(req.params.id);
    if (!events) {
      return res.status(404).json({ error: `Execution not found: ${req.params.id}` });
    }
    res.json({ events });
  });

  return router;
}
