#!/usr/bin/env node

/**
 * Workflow MCP Server
 *
 * An MCP server for building and executing SP-API workflows
 * using Amazon States Language (ASL).
 *
 * Tools:
 * - Builder: create_workflow, add_task_state, add_choice_state, etc.
 * - Interpreter: execute_workflow, get_execution_status, etc.
 * - Callback: list_pending_callbacks, submit_callback, etc.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import modules
import { createBuilderTools, handleBuilderTool, getWorkflowStore, initializeWorkflowStore } from './src/builder/index.js';
import { createInterpreterTools, handleInterpreterTool, initializeInterpreter, getExecutor } from './src/interpreter/index.js';
import { createCallbackTools, handleCallbackTool, getCallbackHandler, initializeCallbackHandler } from './src/callback/index.js';
import { ExecutionStore } from './src/interpreter/execution-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '.data');

/**
 * Main MCP Server class
 */
class WorkflowMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'workflow-mcp',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Initialize stores with file-based persistence
    initializeWorkflowStore({ dataDir: join(DATA_DIR, 'workflows') });
    initializeCallbackHandler({ storeOptions: { dataDir: join(DATA_DIR, 'callbacks') } });

    // Initialize interpreter with persistent execution store
    initializeInterpreter({
      spApiClient: null,
      callbackHandler: getCallbackHandler(),
      executionStore: new ExecutionStore({ dataDir: join(DATA_DIR, 'executions') })
    });

    // Load SP-API client asynchronously — set on existing executor to preserve stores
    this.createSPAPIClient().then(client => {
      if (client) {
        getExecutor().spApiClient = client;
      }
    });

    this.disabledTools = new Set(
      (process.env.DISABLED_TOOLS || '').split(',').map(s => s.trim()).filter(Boolean)
    );

    this.setupHandlers();
    this._buildWorkflowIdTools();

    if (this.disabledTools.size > 0) {
      console.error(`[workflow-mcp] Disabled tools: ${[...this.disabledTools].join(', ')}`);
    }
    if (process.env.WORKFLOW_ID) {
      console.error(`[workflow-mcp] WORKFLOW_ID override: ${process.env.WORKFLOW_ID}`);
    }
  }

  /**
   * Build a cached set of tool names that declare workflow_id in their input schema.
   */
  _buildWorkflowIdTools() {
    const allTools = [
      ...createBuilderTools(),
      ...createInterpreterTools(),
      ...createCallbackTools(),
    ];
    this._workflowIdTools = new Set(
      allTools
        .filter(t => t.inputSchema?.properties?.workflow_id)
        .map(t => t.name)
    );
  }

  /**
   * Create SP-API client from environment variables (optional)
   */
  async createSPAPIClient() {
    const clientId = process.env.SP_API_CLIENT_ID;
    const clientSecret = process.env.SP_API_CLIENT_SECRET;
    const refreshToken = process.env.SP_API_REFRESH_TOKEN;

    if (clientId && clientSecret && refreshToken) {
      try {
        // Dynamic import to avoid requiring sp-api-core if not needed
        const { createClient } = await import('./src/sp-api-core/index.js');
        const client = await createClient({
          clientId,
          clientSecret,
          refreshToken,
          region: process.env.SP_API_REGION || 'na',
          endpoint: process.env.SP_API_BASE_URL,
          tokenEndpoint: process.env.SP_API_OAUTH_URL
        });
        console.error('[workflow-mcp] SP-API client initialized successfully');
        return client;
      } catch (err) {
        console.error('[workflow-mcp] Failed to create SP-API client:', err.message);
        return null;
      }
    }

    console.error('[workflow-mcp] SP-API credentials not configured');
    return null;
  }

  /**
   * Set up MCP request handlers
   */
  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      let tools = [
        ...createBuilderTools(),
        ...createInterpreterTools(),
        ...createCallbackTools(),
      ];

      if (this.disabledTools.size > 0) {
        tools = tools.filter(t => !this.disabledTools.has(t.name));
      }

      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (this.disabledTools.has(name)) {
          throw new Error(`Tool "${name}" is disabled in this environment`);
        }

        const envWorkflowId = process.env.WORKFLOW_ID;
        if (envWorkflowId && this._workflowIdTools.has(name)) {
          args.workflow_id = envWorkflowId;
        }

        let result;

        // Get shared context
        const context = {
          workflowStore: getWorkflowStore()
        };

        // Route to appropriate module based on tool name
        if (name.startsWith('create_workflow') ||
            name.startsWith('import_workflow') ||
            name.startsWith('add_') ||
            name.startsWith('remove_') ||
            name.startsWith('connect_') ||
            name.startsWith('set_start_') ||
            name.startsWith('get_workflow') ||
            name.startsWith('list_workflows') ||
            name.startsWith('delete_workflow') ||
            name.startsWith('validate_workflow') ||
            name.startsWith('visualize_workflow') ||
            name.startsWith('workflow_to_')) {
          result = await handleBuilderTool(name, args);
        } else if (name.startsWith('execute_') ||
                   name.startsWith('resume_') ||
                   name.startsWith('get_execution') ||
                   name.startsWith('list_executions') ||
                   name.startsWith('abort_')) {
          result = await handleInterpreterTool(name, args, context);
        } else if (name.startsWith('list_pending_') ||
                   name.startsWith('get_callback') ||
                   name.startsWith('submit_callback') ||
                   name.startsWith('extend_callback')) {
          result = await handleCallbackTool(name, args, context);
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error.message,
                tool: name
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    });
  }

  /**
   * Start the MCP server
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Workflow MCP Server running on stdio');
  }
}

// Run the server
const server = new WorkflowMCPServer();
server.run().catch(console.error);
