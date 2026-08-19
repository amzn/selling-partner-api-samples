import { query } from '@anthropic-ai/claude-agent-sdk';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import os from 'os';
import { convertToMermaid } from '../../../src/builder/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../../..');  // repo root
const NODE_MODULES = join(__dirname, '../../node_modules/@anthropic-ai');

function findClaudeBinary() {
  const platform = os.platform();
  const arch = os.arch();
  const bin = platform === 'win32' ? 'claude.exe' : 'claude';
  const pkg = `claude-agent-sdk-${platform}-${arch}`;
  const candidate = join(NODE_MODULES, pkg, bin);
  if (existsSync(candidate)) return candidate;
  return undefined;
}

/**
 * AgentService manages a single chat session with the Claude Agent SDK.
 * Yields typed SSE events from an async generator.
 */
export class AgentService {
  constructor({ mcpServers, systemPrompt, allowedTools, envVars, sessionStore, workflowStore }) {
    this.mcpServers = mcpServers;
    this.systemPrompt = systemPrompt;
    this.allowedTools = allowedTools;
    this.envVars = envVars || {};
    this.sessionStore = sessionStore;
    this.workflowStore = workflowStore;
    this.sessionId = null;
    this.chatInProgress = false;
    this.messages = [];        // accumulated messages for current session
    this.workflowId = null;    // workflow this session is scoped to
  }

  /**
   * Send a message and yield SSE events as the agent responds.
   * @param {string} message - The user's message
   * @param {AbortController} [abortController] - Optional abort controller
   * @yields {object} SSE event objects with `type` field
   */
  async *chat(message, abortController, options = {}) {
    if (this.chatInProgress) {
      yield { type: 'error', message: 'A chat is already in progress' };
      return;
    }

    this.chatInProgress = true;

    // Track workflow scope — reset session if switching to a different workflow
    if (options.workflowId) {
      const currentWfId = this.activeWorkflowId || this.workflowId;
      if (currentWfId && currentWfId !== options.workflowId) {
        this.sessionId = null;
        this.messages = [];
        this.activeWorkflowId = null;
        this.latestMermaid = null;
        this.latestStateCount = 0;
        this.latestSchema = null;
      }
      this.workflowId = options.workflowId;
    }

    // Inject WORKFLOW_ID env var into MCP server config before query()
    this._injectWorkflowIdEnv();

    // Track the user message and build an assistant message
    this.messages.push({ role: 'user', content: message });
    const assistantMsg = { role: 'assistant', content: '', toolCalls: [] };

    // Track tool_use_id -> tool name mapping for identifying tool results
    const toolNameMap = new Map();

    try {
      const claudeBin = findClaudeBinary();
      const options = {
        model: process.env.CLAUDE_DEFAULT_MODEL || 'us.anthropic.claude-opus-4-7',
        ...(claudeBin && { pathToClaudeCodeExecutable: claudeBin }),
        cwd: PROJECT_ROOT,
        allowedTools: this.allowedTools,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        env: { ...process.env, ...this.envVars },
        settingSources: [],
        settings: { env: this.envVars },
      };

      if (Object.keys(this.mcpServers).length > 0) {
        options.mcpServers = this.mcpServers;
      }

      if (this.sessionId) {
        options.resume = this.sessionId;
      }

      // Always inject current workflow context into the system prompt
      options.systemPrompt = this._buildSystemPrompt();

      if (abortController) {
        options.abortController = abortController;
      }

      const stream = query({ prompt: message, options });

      for await (const msg of stream) {
        switch (msg.type) {
          case 'system': {
            if (msg.subtype === 'init') {
              const previousSessionId = this.sessionId;
              this.sessionId = msg.session_id;

              // If SDK returned a different session_id (e.g. couldn't resume),
              // migrate the old session data so we don't lose history.
              if (previousSessionId && previousSessionId !== msg.session_id && this.sessionStore) {
                this.sessionStore.delete(previousSessionId);
              }

              yield { type: 'session', sessionId: msg.session_id };
            }
            break;
          }

          case 'stream_event': {
            const event = msg.event;

            if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
              const toolUseEvent = {
                type: 'tool_use',
                tool: event.content_block.name,
                toolUseId: event.content_block.id,
                input: {},
              };
              assistantMsg.toolCalls.push({ type: 'tool_use', tool: event.content_block.name });
              yield toolUseEvent;
            }

            if (event.type === 'content_block_delta') {
              if (event.delta?.type === 'text_delta') {
                assistantMsg.content += event.delta.text;
                yield { type: 'text', content: event.delta.text };
              }
            }
            break;
          }

          case 'assistant': {
            // Full assistant message — extract tool use IDs for mapping
            if (msg.message?.content) {
              for (const block of msg.message.content) {
                if (block.type === 'tool_use') {
                  toolNameMap.set(block.id, block.name);
                }
              }
            }
            break;
          }

          case 'user': {
            // User messages contain tool results
            if (msg.message?.content && Array.isArray(msg.message.content)) {
              for (const block of msg.message.content) {
                if (block.type === 'tool_result') {
                  const toolName = toolNameMap.get(block.tool_use_id) || 'unknown';
                  const output = extractToolResultText(block);

                  assistantMsg.toolCalls.push({ type: 'tool_result', tool: toolName, output });
                  yield { type: 'tool_result', tool: toolName, output };

                  // Track workflow artifacts from tool results
                  const parsed = safeParse(output);
                  if (parsed) {
                    if (parsed.workflow_id) {
                      this.activeWorkflowId = parsed.workflow_id;
                    }
                    // For any state-modifying tool, fetch diagram + schema via API
                    const isStateMutating = (
                      toolName.includes('add_') || toolName.includes('remove_state') ||
                      toolName.includes('connect_states') || toolName.includes('set_start_state') ||
                      toolName.includes('import_workflow') || toolName.includes('create_workflow')
                    );
                    if (this.activeWorkflowId && isStateMutating) {
                      yield* this._emitWorkflowArtifacts(this.activeWorkflowId);
                    }
                  }
                }
              }
            }
            break;
          }

          case 'result': {
            if (msg.subtype === 'success') {
              if (msg.result) assistantMsg.content = msg.result;
              yield { type: 'result', content: msg.result || '' };
            } else {
              const errors = msg.errors?.join('; ') || msg.subtype || 'unknown error';
              yield { type: 'error', message: errors };
            }
            break;
          }

          // Ignore other message types (replays, status, tasks, etc.)
          default:
            break;
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        yield { type: 'error', message: 'Chat aborted' };
      } else {
        yield { type: 'error', message: err.message || 'Agent error' };
      }
    } finally {
      this.chatInProgress = false;
      // Save assistant message and persist session
      if (assistantMsg.content || assistantMsg.toolCalls.length > 0) {
        this.messages.push(assistantMsg);
      }
      if (this.sessionId && this.sessionStore) {
        const title = this._deriveTitle();
        this.sessionStore.save(this.sessionId, {
          title,
          messages: this.messages,
          workflowId: this.activeWorkflowId || this.workflowId,
          mermaid: this.latestMermaid || null,
          stateCount: this.latestStateCount || 0,
          schema: this.latestSchema || null,
        });
      }
    }
  }

  /**
   * Restore a session from the store — reloads messages and workflowId
   * so that the next save won't lose conversation history.
   * @param {string} sessionId
   */
  restoreSession(sessionId) {
    // Skip if already on this session
    if (this.sessionId === sessionId && this.messages.length > 0) return;

    this.sessionId = sessionId;
    if (this.sessionStore) {
      const session = this.sessionStore.get(sessionId);
      if (session) {
        this.messages = session.messages || [];
        this.workflowId = session.workflowId || null;
        this.activeWorkflowId = session.workflowId || null;
        this.latestMermaid = session.mermaid || null;
        this.latestStateCount = session.stateCount || 0;
        this.latestSchema = session.schema || null;
      }
    }
  }

  /**
   * Reset the session — next chat() call starts a fresh conversation.
   */
  reset() {
    this.sessionId = null;
    this.messages = [];
    this.workflowId = null;
    this.activeWorkflowId = null;
    this.latestMermaid = null;
    this.latestStateCount = 0;
    this.latestSchema = null;
  }

  /**
   * Derive a title from the first user message.
   */
  _deriveTitle() {
    const firstUser = this.messages.find(m => m.role === 'user');
    if (!firstUser) return 'Untitled';
    const text = firstUser.content.trim();
    return text.length > 80 ? text.slice(0, 77) + '...' : text;
  }

  _injectWorkflowIdEnv() {
    const wfId = this.activeWorkflowId || this.workflowId;
    for (const server of Object.values(this.mcpServers)) {
      if (!server.env) server.env = {};
      if (wfId) {
        server.env.WORKFLOW_ID = wfId;
      } else {
        delete server.env.WORKFLOW_ID;
      }
    }
  }

  /**
   * Build the system prompt with workflow context from the current session.
   * Includes workflow ID, state summary, and the mermaid diagram so the
   * agent always has up-to-date context about the workflow it's working on.
   */
  _buildSystemPrompt() {
    let prompt = this.systemPrompt;

    const wfId = this.activeWorkflowId || this.workflowId;
    if (!wfId) return prompt;

    prompt += `\n\n--- CURRENT WORKFLOW CONTEXT ---`;
    prompt += `\nWorkflow ID: ${wfId}`;
    prompt += `\nIMPORTANT: You are working on an existing workflow. Do NOT call create_workflow.`;
    prompt += `\nUse this workflow_id for all tool calls (add_task_state, add_choice_state, connect_states, workflow_to_mermaid, etc.).`;

    if (this.latestStateCount > 0) {
      prompt += `\nState count: ${this.latestStateCount}`;
    }

    if (this.latestMermaid) {
      prompt += `\n\nCurrent workflow diagram:\n\`\`\`mermaid\n${this.latestMermaid}\n\`\`\``;
    }

    if (this.latestSchema && this.latestSchema.States) {
      const stateNames = Object.keys(this.latestSchema.States);
      prompt += `\n\nExisting states: ${stateNames.join(', ')}`;
      if (this.latestSchema.StartAt) {
        prompt += `\nStart state: ${this.latestSchema.StartAt}`;
      }
    }

    return prompt;
  }

  /**
   * Fetch diagram and schema from the web API and yield SSE events.
   * Keeps agent-service decoupled from MCP internals.
   */
  async *_emitWorkflowArtifacts(workflowId) {
    try {
      this.workflowStore.reload(workflowId);
      const workflow = this.workflowStore.get(workflowId);
      if (!workflow) return;

      const schema = this.workflowStore.toASL(workflowId);
      const mermaidResult = convertToMermaid(schema);
      if (mermaidResult.success && mermaidResult.mermaid) {
        this.latestMermaid = mermaidResult.mermaid;
        this.latestStateCount = mermaidResult.state_count || 0;
        yield { type: 'mermaid', mermaid: mermaidResult.mermaid, stateCount: mermaidResult.state_count || 0, workflowId };
      }
      if (schema && schema.States) {
        this.latestSchema = schema;
        yield { type: 'schema', schema, workflowId };
      }
    } catch { /* best effort — don't break the chat stream */ }
  }
}

/**
 * Safely parse a JSON string, returning null on failure.
 */
function safeParse(str) {
  if (!str || typeof str !== 'string') return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Extract text content from a tool_result block.
 */
function extractToolResultText(block) {
  if (typeof block.content === 'string') {
    return block.content;
  }
  if (Array.isArray(block.content)) {
    return block.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');
  }
  return '';
}

