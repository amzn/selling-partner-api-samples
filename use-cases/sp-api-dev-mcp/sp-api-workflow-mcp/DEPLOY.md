# Deploying to AWS (EC2 + CloudFront)

This guide covers deploying the SP-API Workflow MCP web app to an EC2 instance behind CloudFront/ALB.

## Prerequisites

- An EC2 instance running Ubuntu (tested on Ubuntu 24.04, x64)
- SSH key for the instance (e.g., `~/.ssh/your-key.pem`)
- Node.js 22+ installed on the instance
- Security group allowing inbound traffic on port 80
- (Optional) CloudFront distribution and/or ALB pointing to the instance on port 80

## 1. Install Node.js and PM2

```bash
ssh -i ~/.ssh/your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Install Node.js 22 (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

## 2. Clone Repositories

```bash
cd ~

# Main project
git clone <repo-url> Sp-api-workflow-mcp
cd Sp-api-workflow-mcp
npm install

# SP-API MCP Server (provides SP-API endpoint discovery tools)
cd ~
git clone https://github.com/amzn/selling-partner-api-samples.git
cd selling-partner-api-samples/use-cases/sp-api-mcp-server
npm install && npm run build

# SP-API Models (for catalog/schema lookups)
cd ~
git clone https://github.com/amzn/selling-partner-api-models.git
```

## 3. Build the Web Frontend

```bash
cd ~/Sp-api-workflow-mcp/web
npm install
npm run build    # produces web/dist/
```

## 4. Configure Environment

Create `web/.env.json` with your credentials:

```bash
cat > ~/Sp-api-workflow-mcp/web/.env.json << 'ENDJSON'
{
  "SP_API_CLIENT_ID": "amzn1.application-oa2-client.xxxxx",
  "SP_API_CLIENT_SECRET": "amzn1.oa2-cs.v1.xxxxx",
  "SP_API_REFRESH_TOKEN": "Atzr|xxxxx",
  "SP_API_REGION": "na",
  "CLAUDE_CODE_USE_BEDROCK": "1",
  "AWS_REGION": "us-east-1",
  "AWS_BEARER_TOKEN_BEDROCK": "your-bearer-token",
  "AGENT_MCP_SERVERS": {
    "workflow": {
      "command": "node",
      "args": ["../index.js"]
    },
    "amazon-sp-api": {
      "command": "node",
      "args": ["/home/ubuntu/selling-partner-api-samples/use-cases/sp-api-mcp-server/build/index.js"],
      "env": {
        "CATALOG_PATH": "/home/ubuntu/selling-partner-api-models/models"
      }
    }
  },
  "WEB_USERNAME": "admin",
  "WEB_PASSWORD": "your-password"
}
ENDJSON
```

### Configuration Keys

| Key | Required | Description |
|-----|----------|-------------|
| `SP_API_CLIENT_ID` | Yes | SP-API app client ID |
| `SP_API_CLIENT_SECRET` | Yes | SP-API app client secret |
| `SP_API_REFRESH_TOKEN` | Yes | Seller refresh token |
| `SP_API_REGION` | No | `na`, `eu`, or `fe` (default: `na`) |
| `CLAUDE_CODE_USE_BEDROCK` | Yes* | Set to `"1"` to use Bedrock instead of Anthropic API |
| `AWS_REGION` | Yes* | AWS region for Bedrock (e.g., `us-east-1`) |
| `AWS_BEARER_TOKEN_BEDROCK` | Yes* | Bearer token for Bedrock access |
| `AGENT_MCP_SERVERS` | Yes | MCP server definitions (see example above) |
| `WEB_USERNAME` | No | Basic auth username (leave both blank to disable auth) |
| `WEB_PASSWORD` | No | Basic auth password |

*Required when using Bedrock. If using the Anthropic API directly, set `ANTHROPIC_API_KEY` instead.

## 5. Start with PM2

```bash
cd ~/Sp-api-workflow-mcp/web

# Start the app on port 80
PORT=80 pm2 start server/app.js --name app

# Verify it's running
pm2 list
curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:80/api/auth/check

# Save the process list (for auto-restart)
pm2 save
```

## 6. Enable Auto-Start on Reboot

This is critical -- without this, the app won't survive instance reboots:

```bash
# Generate the systemd startup script
pm2 startup systemd -u ubuntu --hp /home/ubuntu

# PM2 will print a command starting with `sudo env PATH=...`
# Copy and run that command, e.g.:
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Save the process list so PM2 knows what to resurrect
pm2 save
```

Verify with:
```bash
systemctl is-enabled pm2-ubuntu    # should print "enabled"
```

## 7. CloudFront / ALB Configuration

If placing the app behind CloudFront and/or an ALB:

### ALB Settings
- **Target group**: Point to the EC2 instance on port 80
- **Health check path**: `/api/auth/check`
- **Idle timeout**: Set to at least 300 seconds (the agent chat SSE stream can be long-lived)

### CloudFront Settings
- **Origin**: Point to the ALB (or directly to the EC2 instance)
- **Origin read timeout**: Set to maximum (60 seconds). The app sends SSE heartbeats every 15 seconds to keep the connection alive within this limit.
- **Cache policy**: Disable caching for `/api/*` paths (use `CachingDisabled` managed policy)
- **Origin request policy**: Forward all headers for `/api/*` (use `AllViewer` managed policy)
- **Allowed HTTP methods**: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE

### Important: SSE Streaming
The agent chat endpoint (`POST /api/agent/chat`) uses Server-Sent Events. The app sends heartbeat comments every 15 seconds to prevent idle timeout disconnects. Ensure no intermediate proxy buffers SSE responses.

## Updating the Deployment

From your local machine, copy changed files and restart:

```bash
# Copy specific files
scp -i ~/.ssh/your-key.pem path/to/changed-file ubuntu@<EC2_PUBLIC_IP>:~/Sp-api-workflow-mcp/path/to/changed-file

# Or sync the whole project (excluding node_modules and data)
rsync -avz --exclude node_modules --exclude .data --exclude web/dist --exclude web/.env.json \
  -e "ssh -i ~/.ssh/your-key.pem" \
  ./ ubuntu@<EC2_PUBLIC_IP>:~/Sp-api-workflow-mcp/

# If frontend changed, rebuild on the server
ssh -i ~/.ssh/your-key.pem ubuntu@<EC2_PUBLIC_IP> "cd ~/Sp-api-workflow-mcp/web && npm run build"

# Restart the app (use --update-env to pick up env changes)
ssh -i ~/.ssh/your-key.pem ubuntu@<EC2_PUBLIC_IP> "PORT=80 pm2 restart app --update-env && pm2 save"
```

### Common Pitfall: Port Mismatch

The app defaults to port 3001 for local development. The PM2 process must have `PORT=80` in its environment. If you restart without `--update-env` or forget `PORT=80`, the app will start on 3001 and CloudFront/ALB will return 504.

To verify: `ss -tlnp | grep ':80'` should show the node process listening.

## Monitoring

```bash
# Process status
pm2 list

# Live logs
pm2 logs app

# Recent logs (no follow)
pm2 logs app --lines 50 --nostream

# PM2 system log (shows start/stop/crash events)
cat ~/.pm2/pm2.log | tail -30

# Check for restart loops
pm2 show app | grep -E 'restarts|uptime|status'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 504 Gateway Timeout | App not listening on port 80 | `PORT=80 pm2 restart app --update-env` |
| App down after reboot | PM2 startup not configured | Run `pm2 startup` + `pm2 save` (see step 6) |
| "network error" during chat | SSE connection dropped by CloudFront/ALB idle timeout | Already mitigated by 15s heartbeats; check CloudFront origin timeout |
| URIError in logs | Bot path-traversal scans | Harmless; the malformed URL middleware rejects them with 400 |
| Agent uses wrong workflow | Stale session state | Server auto-resets when workflow ID changes; clear browser and retry |
