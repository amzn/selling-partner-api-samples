/**
 * File Store
 *
 * Simple JSON file-based persistence for Maps.
 * Reads all .json files from a directory on load,
 * writes individual files on save/delete.
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export class FileStore {
  /**
   * @param {string} dir - Directory to persist JSON files
   */
  constructor(dir) {
    this.dir = dir;
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Load all JSON files from the directory into a Map.
   * @returns {Map<string, object>}
   */
  loadAll() {
    const map = new Map();
    try {
      const files = readdirSync(this.dir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const data = JSON.parse(readFileSync(join(this.dir, file), 'utf8'));
          const id = file.replace('.json', '');
          map.set(id, data);
        } catch { /* skip corrupt files */ }
      }
    } catch { /* dir doesn't exist yet */ }
    return map;
  }

  /**
   * Save a single record to disk.
   * @param {string} id
   * @param {object} data
   */
  save(id, data) {
    writeFileSync(join(this.dir, `${id}.json`), JSON.stringify(data, null, 2));
  }

  /**
   * Delete a record from disk.
   * @param {string} id
   */
  remove(id) {
    const filePath = join(this.dir, `${id}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  /**
   * Delete all files in the directory.
   */
  clear() {
    try {
      const files = readdirSync(this.dir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        unlinkSync(join(this.dir, file));
      }
    } catch { /* ignore */ }
  }
}
