#!/usr/bin/env node

/**
 * SP-API Dev MCP - Consolidated package entry point.
 *
 * Routes to the correct bundled MCP server based on the CLI argument.
 *
 * Usage:
 *   npx @spectrumtest/sp-api-dev-mcp sp-api-dev-assistant-mcp-server
 *   npx @spectrumtest/sp-api-dev-mcp amazon-data-kiosk-sc-mcp-server
 *   npx @spectrumtest/sp-api-dev-mcp amazon-data-kiosk-vc-mcp-server
 *   npx @spectrumtest/sp-api-dev-mcp sp-api-mcp-server
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundledDir = join(__dirname, "..", "bundled-servers");

const SERVER_MAP: Record<string, string> = {
  "sp-api-dev-assistant-mcp-server": "sp-api-dev-assistant-mcp-server.mjs",
  "amazon-data-kiosk-sc-mcp-server": "amazon-data-kiosk-sc-mcp-server.mjs",
  "amazon-data-kiosk-vc-mcp-server": "amazon-data-kiosk-vc-mcp-server.mjs",
  "sp-api-mcp-server": "sp-api-mcp-server-wrapper.mjs",
};

const serverName = process.argv[2];

if (!serverName || !SERVER_MAP[serverName]) {
  const available = Object.keys(SERVER_MAP)
    .map((name) => `  ${name}`)
    .join("\n");

  console.error(
    `Usage: sp-api-dev-mcp <server-name>\n\nAvailable servers:\n${available}\n`,
  );
  process.exit(1);
}

const serverFile = join(bundledDir, SERVER_MAP[serverName]);
await import(serverFile);
