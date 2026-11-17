import { join } from "path";
import { homedir } from "os";

/** Persistent cache directory under user home — shared across all tools */
export const MCP_CACHE_DIR = join(homedir(), ".sp-api-dev-mcp");
