# MCP REST API Tester Plugin

This plugin automatically configures the [dkmaker-mcp-rest-api](https://github.com/dkmaker/mcp-rest-api) MCP server for Claude Code.

## What This Plugin Does

When installed, this plugin adds the REST API tester MCP server to Claude Code, enabling you to test HTTP endpoints directly from conversations with Claude.

## Installation

```bash
/plugin install mcp-rest-api@my-claude-plugins
```

Or from the terminal:
```bash
claude plugin install mcp-rest-api@my-claude-plugins
```

## Configuration

The plugin uses environment variables with the `REST_MCP_` prefix to avoid conflicts with other tools.

### Configuration Template

Copy this template to your settings file and uncomment/configure the variables you need:

```json
{
  "env": {
    "REST_MCP_BASE_URL": "https://api.example.com",

    // Authentication - choose ONE method:

    // Option 1: Bearer Token
    // "REST_MCP_AUTH_BEARER": "YOUR_BEARER_TOKEN_HERE",

    // Option 2: Basic Auth
    // "REST_MCP_AUTH_USERNAME": "YOUR_USERNAME_HERE",
    // "REST_MCP_AUTH_PASSWORD": "YOUR_PASSWORD_HERE",

    // Option 3: API Key
    // "REST_MCP_APIKEY_HEADER": "X-API-Key",
    // "REST_MCP_APIKEY_VALUE": "YOUR_API_KEY_HERE",

    // Optional settings:
    // "REST_MCP_SSL_VERIFY": "true",
    // "REST_MCP_RESPONSE_LIMIT": "10000",

    // Custom headers (optional):
    // "HEADER_X-API-Version": "2.0",
    // "HEADER_Accept": "application/json",
    // "HEADER_Authorization": "custom-auth-value"
  }
}
```

### Option 1: Shell Environment (Recommended)

Set environment variables before starting Claude Code:

```bash
# In your ~/.bashrc or ~/.zshrc
export REST_MCP_BASE_URL="https://your-api.com"
export REST_MCP_AUTH_BEARER="YOUR_BEARER_TOKEN_HERE"

# Or for one session
REST_MCP_BASE_URL="http://localhost:3000" claude
```

### Option 2: Project Settings

Edit `.claude/settings.json` in your project and paste this template:

```json
{
  "env": {
    "REST_MCP_BASE_URL": "http://localhost:3000",

    // Authentication - choose ONE method:

    // Option 1: Bearer Token
    // "REST_MCP_AUTH_BEARER": "YOUR_BEARER_TOKEN_HERE",

    // Option 2: Basic Auth
    "REST_MCP_AUTH_USERNAME": "YOUR_USERNAME_HERE",
    "REST_MCP_AUTH_PASSWORD": "YOUR_PASSWORD_HERE",

    // Option 3: API Key
    // "REST_MCP_APIKEY_HEADER": "X-API-Key",
    // "REST_MCP_APIKEY_VALUE": "YOUR_API_KEY_HERE",

    // Optional settings:
    // "REST_MCP_SSL_VERIFY": "false",
    // "REST_MCP_RESPONSE_LIMIT": "50000"
  }
}
```

### Option 3: User Settings (All Projects)

Edit `~/.claude/settings.json` and paste this template:

```json
{
  "env": {
    "REST_MCP_BASE_URL": "https://api.production.com",

    // Authentication - choose ONE method:

    // Option 1: Bearer Token
    "REST_MCP_AUTH_BEARER": "YOUR_PRODUCTION_TOKEN_HERE",

    // Option 2: Basic Auth
    // "REST_MCP_AUTH_USERNAME": "YOUR_USERNAME_HERE",
    // "REST_MCP_AUTH_PASSWORD": "YOUR_PASSWORD_HERE",

    // Option 3: API Key
    // "REST_MCP_APIKEY_HEADER": "X-API-Key",
    // "REST_MCP_APIKEY_VALUE": "YOUR_API_KEY_HERE",

    // Optional settings:
    "REST_MCP_SSL_VERIFY": "true",
    "REST_MCP_RESPONSE_LIMIT": "10000"
  }
}
```

## Environment Variables Reference

All variables use the `REST_MCP_` prefix to avoid naming conflicts.

| Variable | Maps to MCP Server | Description | Default |
|----------|-------------------|-------------|---------|
| `REST_MCP_BASE_URL` | `REST_BASE_URL` | Base URL for API requests | `https://api.example.com` |
| `REST_MCP_AUTH_BEARER` | `AUTH_BEARER` | Bearer token authentication | None |
| `REST_MCP_AUTH_USERNAME` | `AUTH_BASIC_USERNAME` | Basic auth YOUR_USERNAME_HERE | None |
| `REST_MCP_AUTH_PASSWORD` | `AUTH_BASIC_PASSWORD` | Basic auth YOUR_PASSWORD_HERE | None |
| `REST_MCP_APIKEY_HEADER` | `AUTH_APIKEY_HEADER_NAME` | API key header name | None |
| `REST_MCP_APIKEY_VALUE` | `AUTH_APIKEY_VALUE` | API key value | None |
| `REST_MCP_SSL_VERIFY` | `REST_ENABLE_SSL_VERIFY` | Enable SSL verification | `true` |
| `REST_MCP_RESPONSE_LIMIT` | `REST_RESPONSE_SIZE_LIMIT` | Max response size (bytes) | `10000` |

**Custom Headers**: Use the `HEADER_*` prefix directly (not `REST_MCP_`):
```bash
export HEADER_X-API-Version="2.0"
export HEADER_Accept="application/json"
```

## Quick Start Examples

### Testing a Local API

```bash
# Configure for local development
export REST_MCP_BASE_URL="http://localhost:3000"
export REST_MCP_AUTH_BEARER="dev-token"

# Start Claude Code
claude

# Ask Claude to test endpoints
> Test the GET /users endpoint
> Make a POST to /auth/login with email and YOUR_PASSWORD_HERE
```

### Testing a Production API

```bash
# Configure for production
export REST_MCP_BASE_URL="https://api.production.com"
export REST_MCP_AUTH_BEARER="YOUR_BEARER_TOKEN_HERE"
export REST_MCP_SSL_VERIFY="true"

claude
```

### Using Basic Auth

```bash
export REST_MCP_BASE_URL="https://api.example.com"
export REST_MCP_AUTH_USERNAME="YOUR_USERNAME_HERE"
export REST_MCP_AUTH_PASSWORD="YOUR_PASSWORD_HERE"

claude
```

### Using API Key

```bash
export REST_MCP_BASE_URL="https://api.example.com"
export REST_MCP_APIKEY_HEADER="X-API-Key"
export REST_MCP_APIKEY_VALUE="YOUR_API_KEY_HERE"

claude
```

## Authentication Methods

The MCP server supports multiple authentication methods. Configure only one:

| Method | Variables |
|--------|-----------|
| **Bearer Token** | `REST_MCP_AUTH_BEARER` |
| **Basic Auth** | `REST_MCP_AUTH_USERNAME` + `REST_MCP_AUTH_PASSWORD` |
| **API Key** | `REST_MCP_APIKEY_HEADER` + `REST_MCP_APIKEY_VALUE` |

## Usage

Once installed and configured, ask Claude to test REST endpoints:

```
Test the GET /users endpoint
Make a POST request to /auth/login with {"email": "test@example.com", "password": "your-password"}
What does the /api/status endpoint return?
Check if the /health endpoint is responding
Send a PUT request to /users/123 to update the user
```

Claude will automatically use the `test_request` tool from the MCP server.

## Troubleshooting

### MCP server not appearing

After installation, restart Claude Code:
```bash
# Exit Claude Code (Ctrl+D or /exit)
# Start it again
claude

# Check if server is loaded
/mcp
```

You should see "rest-api" in the list.

### Environment variables not working

1. Set the env vars **before** starting Claude Code
2. Or configure them in `settings.json`
3. **Restart Claude Code** after changing settings

Check your current env vars:
```bash
env | grep REST_MCP
```

### NPM package not found

The plugin uses `npx -y dkmaker-mcp-rest-api` which downloads the package on first use.

Requirements:
- Node.js 18+ installed
- Internet connection for first run

## Uninstall

```bash
/plugin uninstall mcp-rest-api@my-claude-plugins
```

## More Information

- **GitHub**: https://github.com/dkmaker/mcp-rest-api
- **NPM**: https://www.npmjs.com/package/dkmaker-mcp-rest-api
- **MCP Server Documentation**: Full configuration guide in the main repository
