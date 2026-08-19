import { Router } from 'express';

export function createAgentRoutes({ agentService, sessionStore }) {
  const router = Router();

  // Chat with the agent — streams SSE events
  router.post('/chat', async (req, res) => {
    const { message, sessionId, workflowId } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Restore session state (messages, workflowId) from the store.
    // This handles server restarts and switching between sessions.
    if (sessionId) {
      agentService.restoreSession(sessionId);
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send SSE heartbeats to prevent CloudFront/ALB idle timeout (30s/60s)
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': heartbeat\n\n');
      }
    }, 15000);

    // Abort the agent subprocess when the client disconnects
    const abortController = new AbortController();
    res.on('close', () => {
      clearInterval(heartbeat);
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    try {
      for await (const event of agentService.chat(message, abortController, { workflowId })) {
        if (res.writableEnded) break;
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      }
    }

    clearInterval(heartbeat);
    if (!res.writableEnded) {
      res.write(`event: done\ndata: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    }
  });

  // Get the current model
  router.get('/model', (req, res) => {
    res.json({ model: process.env.CLAUDE_DEFAULT_MODEL || 'us.anthropic.claude-opus-4-7' });
  });

  // List configured MCP servers
  router.get('/mcp-servers', (req, res) => {
    const servers = Object.entries(agentService.mcpServers || {}).map(([name, cfg]) => ({
      name,
      command: cfg.command,
    }));
    res.json(servers);
  });

  // Reset the agent session
  router.post('/reset', (req, res) => {
    agentService.reset();
    res.json({ success: true });
  });

  // List all saved sessions
  router.get('/sessions', (req, res) => {
    res.json(sessionStore.list());
  });

  // List sessions for a specific workflow
  router.get('/sessions/by-workflow/:workflowId', (req, res) => {
    res.json(sessionStore.listByWorkflow(req.params.workflowId));
  });

  // Get a single session by ID
  router.get('/sessions/:id', (req, res) => {
    const session = sessionStore.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  // Delete a session
  router.delete('/sessions/:id', (req, res) => {
    const deleted = sessionStore.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true });
  });

  return router;
}
