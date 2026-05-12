#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundledDir = join(__dirname, "..", "bundled-servers");

const SERVER_MAP: Record<string, string> = {
  "sp-api-dev-assistant-mcp-server":
    "sp-api-dev-assistant-mcp-server-wrapper.mjs",
  "sp-api-workflow-mcp-server": "sp-api-workflow-mcp-server.mjs",
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
