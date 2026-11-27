#!/usr/bin/env bash
# Reports whether the local SP-API sandbox is up.
#
# Every skill in this plugin calls the sandbox on loopback. Without this, a
# stopped sandbox surfaces as a bare connection error mid-task; with it, the
# session starts knowing the server is down and what to run.
#
# Always exits 0: this is advisory context, and a failed probe must never block
# a session that was not going to touch the sandbox at all.
set -uo pipefail

PORT="${PORT:-9001}"
BASE="http://localhost:${PORT}"

if curl --silent --show-error --max-time 2 --output /dev/null "${BASE}/data" 2>/dev/null; then
  echo "SP-API sandbox is running at ${BASE} (MCP endpoint at ${BASE}/mcp)."
else
  echo "SP-API sandbox is NOT reachable at ${BASE}. Start it with 'npm run dev' from the local-ai-sandbox directory before using the sandbox skills; its MCP tools will fail to connect until then."
fi

exit 0
