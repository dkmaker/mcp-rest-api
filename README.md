# MCP REST API Tester (Enhanced)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Package](https://img.shields.io/npm/v/@qwang007/mcp-rest-api.svg)](https://www.npmjs.com/package/@qwang007/mcp-rest-api)

> **📦 Enhanced Fork**: This is an enhanced version of [dkmaker-mcp-rest-api](https://github.com/dkmaker/mcp-rest-api) with added **file upload support**. Original project by [@zenturacp](https://github.com/zenturacp).
>
> **New in v0.5.0**: Full multipart/form-data file upload support! 🎉

A TypeScript-based MCP server that enables testing of REST APIs through Cline and Claude Desktop. This tool allows you to test and interact with any REST API endpoints directly from your development environment, including **uploading files**.

## Installation

### Install via npm

```bash
npm install -g @qwang007/mcp-rest-api
```

Or use with npx (no installation required):

```bash
npx @qwang007/mcp-rest-api
```

### Manual Setup

1. Configure Cline Custom Instructions:

To ensure Cline understands how to effectively use this tool, add the following to your Cline custom instructions (Settings > Custom Instructions):

```markdown
# REST API Testing Instructions

The `test_request` tool enables testing, debugging, and interacting with REST API endpoints. The tool provides comprehensive request/response information and handles authentication automatically.

## When to Use

- Testing specific API endpoints
- Debugging API responses
- Verifying API functionality
- Checking response times
- Validating request/response formats
- Testing local development servers
- Testing API sequences
- Verifying error handling

## Key Features

- Supports GET, POST, PUT, DELETE, PATCH methods
- Handles authentication (Basic, Bearer, API Key)
- Normalizes endpoints automatically
- Provides detailed response information
- Configurable SSL verification and response limits

## Resources

The following resources provide detailed documentation:

- examples: Usage examples and common patterns
- response-format: Response structure and fields
- config: Configuration options and setup guide

Access these resources to understand usage, response formats, and configuration options.

## Important Notes

- Review API implementation for expected behavior
- Handle sensitive data appropriately
- Consider rate limits and API constraints
- Restart server after configuration changes
```

2. Add the server to your MCP configuration:

While these instructions are for Cline, the server should work with any MCP implementation. Configure based on your operating system:

### Windows
⚠️ **IMPORTANT**: Due to a known issue with Windows path resolution ([issue #40](https://github.com/modelcontextprotocol/servers/issues/40)), you must use the full path instead of %APPDATA%.

Add to `C:\Users\<YourUsername>\AppData\Roaming\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`:
```json
{
  "mcpServers": {
    "rest-api": {
      "command": "node",
      "args": [
        "C:/Users/<YourUsername>/AppData/Roaming/npm/node_modules/@qwang007/mcp-rest-api/build/index.js"
      ],
      "env": {
        "REST_BASE_URL": "https://api.example.com",
        // Basic Auth
        "AUTH_BASIC_USERNAME": "your-username",
        "AUTH_BASIC_PASSWORD": "your-password",
        // OR Bearer Token
        "AUTH_BEARER": "your-token",
        // OR API Key
        "AUTH_APIKEY_HEADER_NAME": "X-API-Key",
        "AUTH_APIKEY_VALUE": "your-api-key",
        // SSL Verification (enabled by default)
        "REST_ENABLE_SSL_VERIFY": "false", // Set to false to disable SSL verification for self-signed certificates
        // Response Size Limit (optional, defaults to 10000 bytes)
        "REST_RESPONSE_SIZE_LIMIT": "10000", // Maximum response size in bytes
        // File Upload Size Limit (optional, defaults to 10485760 bytes = 10MB)
        "FILE_UPLOAD_SIZE_LIMIT": "52428800", // Maximum file upload size in bytes (50MB)
        // Custom Headers (optional)
        "HEADER_X-API-Version": "2.0",
        "HEADER_Custom-Client": "my-client",
        "HEADER_Accept": "application/json"
      }
    }
  }
}
```

### macOS
Add to `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`:
```json
{
  "mcpServers": {
    "rest-api": {
      "command": "npx",
      "args": [
        "-y",
        "@qwang007/mcp-rest-api"
      ],
      "env": {
        "REST_BASE_URL": "https://api.example.com",
        // Basic Auth
        "AUTH_BASIC_USERNAME": "your-username",
        "AUTH_BASIC_PASSWORD": "your-password",
        // OR Bearer Token
        "AUTH_BEARER": "your-token",
        // OR API Key
        "AUTH_APIKEY_HEADER_NAME": "X-API-Key",
        "AUTH_APIKEY_VALUE": "your-api-key",
        // SSL Verification (enabled by default)
        "REST_ENABLE_SSL_VERIFY": "false", // Set to false to disable SSL verification for self-signed certificates
        // File Upload Size Limit (optional, defaults to 10485760 bytes = 10MB)
        "FILE_UPLOAD_SIZE_LIMIT": "52428800", // Maximum file upload size in bytes (50MB)
        // Custom Headers (optional)
        "HEADER_X-API-Version": "2.0",
        "HEADER_Custom-Client": "my-client",
        "HEADER_Accept": "application/json"
      }
    }
  }
}
```

Note: Replace the environment variables with your actual values. Only configure one authentication method at a time:
1. Basic Authentication (username/password)
2. Bearer Token (if Basic Auth is not configured)
3. API Key (if neither Basic Auth nor Bearer Token is configured)

## Features

- Test REST API endpoints with different HTTP methods
- Support for GET, POST, PUT, DELETE, and PATCH requests
- **File Upload Support**:
  - Upload single or multiple files in one request
  - Multipart/form-data encoding
  - Customizable field names, filenames, and content types
  - Combined file + form field uploads
  - Configurable file size limits (default: 10MB per file)
  - Path traversal protection for security
- Detailed response information including status, headers, and body
- Custom Headers:
  - Global headers via HEADER_* environment variables
  - Case-insensitive prefix (HEADER_, header_, HeAdEr_)
  - Case preservation for header names
  - Priority-based application (per-request > auth > custom)
- Request body handling for POST/PUT methods
- Response Size Management:
  - Automatic response size limiting (default: 10KB/10000 bytes)
  - Configurable size limit via REST_RESPONSE_SIZE_LIMIT environment variable
  - Clear truncation metadata when responses exceed limit
  - Preserves response structure while only truncating body content

- SSL Certificate Verification:
  - Enabled by default for secure operation
  - Can be disabled for self-signed certificates or development environments
  - Control via REST_ENABLE_SSL_VERIFY environment variable
- Multiple authentication methods:
  - Basic Authentication (username/password)
  - Bearer Token Authentication
  - API Key Authentication (custom header)

## Usage Examples

Once installed and configured, you can use the REST API Tester through Cline to test your API endpoints:

```typescript
// Test a GET endpoint
use_mcp_tool('rest-api', 'test_request', {
  "method": "GET",
  "endpoint": "/users"
});

// Test a POST endpoint with body
use_mcp_tool('rest-api', 'test_request', {
  "method": "POST",
  "endpoint": "/users",
  "body": {
    "name": "John Doe",
    "email": "john@example.com"
  }
});

// Test with custom headers
use_mcp_tool('rest-api', 'test_request', {
  "method": "GET",
  "endpoint": "/products",
  "headers": {
    "Accept-Language": "en-US",
    "X-Custom-Header": "custom-value"
  }
});

// Upload a file
use_mcp_tool('rest-api', 'test_request', {
  "method": "POST",
  "endpoint": "/upload",
  "files": [
    {
      "fieldName": "avatar",
      "filePath": "./profile-pic.jpg"
    }
  ]
});

// Upload multiple files with form fields
use_mcp_tool('rest-api', 'test_request', {
  "method": "POST",
  "endpoint": "/posts",
  "files": [
    {
      "fieldName": "thumbnail",
      "filePath": "./image.png"
    }
  ],
  "formFields": {
    "title": "My Post",
    "description": "Post description"
  }
});
```

## Development

1. Clone the repository:
```bash
git clone https://github.com/zenturacp/mcp-rest-api.git
cd mcp-rest-api
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
