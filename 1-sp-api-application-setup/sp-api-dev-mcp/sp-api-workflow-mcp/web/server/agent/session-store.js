import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = join(__dirname, '../../data/sessions');

// Ensure directory exists
if (!existsSync(SESSIONS_DIR)) {
  mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * Persists chat sessions as JSON files on disk.
 */
export class SessionStore {
  /**
   * Save or update a session.
   * @param {string} sessionId
   * @param {{ title?: string, messages: object[], workflowId?: string, mermaid?: string, stateCount?: number, schema?: object }} data
   */
  save(sessionId, data) {
    const filePath = join(SESSIONS_DIR, `${sessionId}.json`);
    const existing = this._read(filePath);

    const session = {
      id: sessionId,
      title: data.title || existing?.title || 'Untitled',
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: data.messages,
      workflowId: data.workflowId || existing?.workflowId || null,
      mermaid: data.mermaid || existing?.mermaid || null,
      stateCount: data.stateCount || existing?.stateCount || 0,
      schema: data.schema || existing?.schema || null,
    };

    writeFileSync(filePath, JSON.stringify(session, null, 2));
    return session;
  }

  /**
   * List all sessions, sorted by most recently updated.
   * Returns summary objects (no messages).
   */
  list() {
    const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    const sessions = [];

    for (const file of files) {
      const data = this._read(join(SESSIONS_DIR, file));
      if (data) {
        sessions.push({
          id: data.id,
          title: data.title,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          messageCount: data.messages?.length || 0,
          workflowId: data.workflowId || null,
        });
      }
    }

    sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return sessions;
  }

  /**
   * Get a full session by ID.
   */
  get(sessionId) {
    return this._read(join(SESSIONS_DIR, `${sessionId}.json`));
  }

  /**
   * List sessions for a specific workflow.
   */
  listByWorkflow(workflowId) {
    return this.list().filter(s => s.workflowId === workflowId);
  }

  /**
   * Delete a session.
   */
  delete(sessionId) {
    const filePath = join(SESSIONS_DIR, `${sessionId}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
    return false;
  }

  _read(filePath) {
    try {
      if (!existsSync(filePath)) return null;
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      return null;
    }
  }
}
