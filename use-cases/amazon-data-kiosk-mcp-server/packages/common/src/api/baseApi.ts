// src/api/baseApi.ts
import fetch from 'node-fetch';
import { getAccessToken } from '../auth/amazonAuth.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configuration Constants
export const BASE_URL = process.env.DATA_KIOSK_BASE_URL || "https://sellingpartnerapi-na.amazon.com";

// Create downloads directory in user's home directory if it doesn't exist
const downloadsDir = path.join(os.homedir(), 'amazon-data-kiosk-downloads');
try {
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
} catch (error) {
  console.error('Error creating downloads directory:', error);
  // Fall back to temp directory if home directory is not accessible
  const tempDir = path.join(os.tmpdir(), 'amazon-data-kiosk-downloads');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
}

/**
 * Make an authenticated API request to the Amazon Data Kiosk API
 * @param path - API path relative to the base URL
 * @param method - HTTP method
 * @param body - Optional request body
 * @returns Promise that resolves to the API response
 */
export async function makeApiRequest(path: string, method: string, body?: any): Promise<any> {
  const accessToken = await getAccessToken();

  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "x-amz-access-token": accessToken,
    "Content-Type": "application/json"
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error making API request to ${path}:`, error);
    throw error;
  }
}

/**
 * Download document content and save to local filesystem
 * @param url - Document download URL
 * @returns Promise that resolves to metadata about the saved content
 */
export async function downloadDocument(url: string): Promise<{
  savedPath: string;
  size: number;
  timestamp: string;
  contentPreview: string;
}> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download error: ${response.status} ${response.statusText}`);
    }

    // Generate filename based on timestamp and URL
    const timestamp = new Date().toISOString().replace(/[:]/g, '-');
    const urlHash = Buffer.from(url).toString('base64').substring(0, 8);
    const filename = `document_${timestamp}_${urlHash}.jsonl`;
    const filePath = path.join(downloadsDir, filename);

    // Get the content
    const content = await response.text();

    // Write content to file
    fs.writeFileSync(filePath, content, 'utf8');

    // Get file stats
    const stats = fs.statSync(filePath);

    return {
      savedPath: filePath,
      size: stats.size,
      timestamp: timestamp,
      contentPreview: content.substring(0, 1000) + (content.length > 1000 ? '...' : '')
    };
  } catch (error) {
    console.error("Error downloading document:", error);
    throw error;
  }
}

/**
 * Read content from a file with pagination support
 * @param filePath - Path to the file to read
 * @param maxLines - Maximum number of lines to read
 * @param startLine - Line number to start reading from
 * @returns Object containing file information and content
 */
export async function readFileContent(
  filePath: string,
  maxLines?: number,
  startLine: number = 1
): Promise<{
  fileInfo: {
    path: string;
    size: string;
    created: string;
    modified: string;
    extension: string;
    totalLines: number;
  };
  content: string;
  startLine: number;
  endLine: number;
  hasMoreLines: boolean;
}> {
  // Validate file path
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at path: ${filePath}`);
  }

  // Get file stats
  const stats = fs.statSync(filePath);

  // Get file info
  const fileInfo = {
    path: filePath,
    size: (stats.size / 1024).toFixed(2) + ' KB',
    created: stats.birthtime.toISOString(),
    modified: stats.mtime.toISOString(),
    extension: path.extname(filePath).toLowerCase(),
    totalLines: 0
  };

  // Read file content
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  fileInfo.totalLines = lines.length;

  // Calculate start and end lines
  const start = Math.max(0, startLine - 1);
  const end = maxLines ? Math.min(lines.length, start + maxLines) : lines.length;

  // Get the requested portion of content
  const selectedLines = lines.slice(start, end);

  // Format content based on file type
  let formattedContent = '';
  if (fileInfo.extension === '.json' || fileInfo.extension === '.jsonl') {
    formattedContent = selectedLines.map(line => {
      try {
        const parsed = JSON.parse(line);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return line;
      }
    }).join('\n');
  } else {
    formattedContent = selectedLines.join('\n');
  }

  return {
    fileInfo,
    content: formattedContent,
    startLine: startLine,
    endLine: end,
    hasMoreLines: lines.length > end
  };
}