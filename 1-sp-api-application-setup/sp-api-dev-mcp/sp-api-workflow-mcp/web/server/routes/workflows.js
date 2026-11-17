import { Router } from 'express';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { convertToMermaid } from '../../../src/builder/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = join(__dirname, '../../../workflows');

export function createWorkflowRoutes({ workflowStore, loadWorkflows }) {
  const router = Router();

  // List all workflows
  router.get('/', (req, res) => {
    // Reload from disk to pick up workflows created by the MCP subprocess
    workflowStore.reloadAll();
    res.json(workflowStore.list());
  });

  // Create a new empty workflow
  router.post('/', (req, res) => {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const result = workflowStore.create(name.trim(), description || '');
    res.status(201).json(result);
  });

  // Get workflow schema (ASL)
  router.get('/:id', (req, res) => {
    // Reload from disk to pick up changes made by the MCP subprocess
    workflowStore.reload(req.params.id);
    const workflow = workflowStore.get(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: `Workflow not found: ${req.params.id}` });
    }
    const schema = workflowStore.toASL(req.params.id);
    res.json({
      workflow_id: req.params.id,
      name: workflow.name,
      description: workflow.description,
      schema,
    });
  });

  // Get live mermaid diagram for a workflow
  router.get('/:id/diagram', (req, res) => {
    workflowStore.reload(req.params.id);
    const workflow = workflowStore.get(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: `Workflow not found: ${req.params.id}` });
    }
    if (workflow.states.size === 0) {
      return res.json({ workflowId: req.params.id, mermaid: null, stateCount: 0 });
    }
    const schema = workflowStore.toASL(req.params.id);
    const mermaidResult = convertToMermaid(schema);
    if (mermaidResult.success) {
      return res.json({
        workflowId: req.params.id,
        mermaid: mermaidResult.mermaid,
        stateCount: mermaidResult.state_count || 0,
      });
    }
    res.json({ workflowId: req.params.id, mermaid: null, stateCount: workflow.states.size });
  });

  // Import a workflow from ASL JSON — saves to workflows/ dir and returns mermaid
  router.post('/import', (req, res) => {
    const { name, schema, description } = req.body;
    if (!name || !schema) {
      return res.status(400).json({ error: 'name and schema are required' });
    }
    const result = workflowStore.importSchema(name, schema, description || '');
    if (!result.success) {
      return res.status(400).json(result);
    }
    // Save to workflows/ directory for persistence across restarts
    if (!existsSync(WORKFLOWS_DIR)) {
      mkdirSync(WORKFLOWS_DIR, { recursive: true });
    }
    const fileName = (name || 'workflow')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    const filePath = join(WORKFLOWS_DIR, `${fileName}.json`);
    writeFileSync(filePath, JSON.stringify(schema, null, 2));
    result.workflowPath = `workflows/${fileName}.json`;

    // Generate mermaid from the imported schema
    const mermaidResult = convertToMermaid(schema);
    if (mermaidResult.success) {
      result.mermaid = mermaidResult.mermaid;
      result.state_count = mermaidResult.state_count;
    }
    res.status(201).json(result);
  });

  // Delete a workflow
  router.delete('/:id', (req, res) => {
    const result = workflowStore.delete(req.params.id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  });

  // Reload workflows from the workflows/ directory
  router.post('/reload', (req, res) => {
    try {
      loadWorkflows();
      res.json({ success: true, ...workflowStore.list() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
