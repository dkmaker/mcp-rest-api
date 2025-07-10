# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based MCP (Model Context Protocol) server that provides REST API testing capabilities. It acts as a bridge between Claude/Cline and REST APIs, allowing testing of HTTP endpoints with authentication and custom headers.

## Architecture

- **Single-file MCP server**: Primary logic in `src/index.ts`
- **Resource system**: Documentation files in `src/resources/` are exposed as MCP resources
- **Environment-based configuration**: All settings via environment variables
- **ES modules**: Uses `"type": "module"` in package.json

### Key Components

- `RestTester` class: Main server implementation using MCP SDK
- `test_request` tool: Single MCP tool for making HTTP requests
- Authentication system: Supports Basic Auth, Bearer tokens, and API keys
- Custom headers: Environment variables with `HEADER_` prefix
- Response size limiting: Configurable truncation for large responses

## Development Commands

```bash
# Install dependencies
npm install

# Build the project (includes prebuild script)
npm run build

# Watch mode for development
npm run watch

# Test with MCP inspector
npm run inspector

# Commit linting
npx commitlint --from HEAD~1 --to HEAD
```

## Build Process

The build process includes:
1. `scripts/build.js` generates `src/version.ts` from package.json
2. TypeScript compilation to `build/` directory
3. Resources copied from `src/resources/` to `build/resources/`

## Environment Configuration

Optional:
- `REST_BASE_URL`: Base URL for all API requests (if not set, endpoints must be full URLs)

Other optional settings:
- `REST_RESPONSE_SIZE_LIMIT`: Max response size in bytes (default: 10000)
- `REST_ENABLE_SSL_VERIFY`: SSL verification (default: true)
- Authentication: `AUTH_BASIC_USERNAME/PASSWORD`, `AUTH_BEARER`, or `AUTH_APIKEY_HEADER_NAME/VALUE`
- Custom headers: `HEADER_*` environment variables

## Testing

The package includes an MCP inspector command for testing the server functionality. Use `npm run inspector` to start an interactive testing session.

## Important Notes

- **When REST_BASE_URL is configured**: HTTP endpoints must be paths only (e.g., `/users`), not full URLs
- **When REST_BASE_URL is NOT configured**: HTTP endpoints must be full URLs (e.g., `https://api.example.com/users`)
- Optional `host` parameter can override base URL for single requests
- Authentication headers are automatically added based on configuration
- Response bodies are truncated if they exceed the size limit
- The server accepts any HTTP status code as valid for testing purposes