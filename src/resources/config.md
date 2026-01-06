# REST API Tester Configuration

This document describes all available configuration options for the REST API testing tool.

## Core Configuration

### REST_BASE_URL (Required)
- Description: The base URL that all endpoint paths will be resolved against
- Example: `http://localhost:3000` or `https://api.example.com`
- Usage: All endpoint paths will be appended to this URL. For example, if REST_BASE_URL is `http://localhost:3000` and you use the endpoint `/api/users`, the full URL will be `http://localhost:3000/api/users`

### REST_RESPONSE_SIZE_LIMIT (Optional)
- Description: Maximum size in bytes for response data
- Default: 10000 (10KB)
- Example: `50000` for 50KB limit
- Usage: Helps prevent memory issues with large responses. If a response exceeds this size, it will be truncated and a warning message will be included

### REST_ENABLE_SSL_VERIFY (Optional)
- Description: Controls SSL certificate verification
- Default: `true`
- Values: Set to `false` to disable SSL verification for self-signed certificates
- Usage: Disable when testing APIs with self-signed certificates in development environments

## Custom Headers Configuration

### Custom Headers (Optional)
- Description: Add custom headers to all requests using environment variables
- Pattern: `HEADER_<HeaderName>=<Value>` (prefix is case-insensitive)
- Examples:
  ```bash
  HEADER_X-API-Version=2.0
  header_Custom-Client=my-client
  HeAdEr_Accept=application/json
  ```
- Usage: Headers are added to all requests. The header name after `HEADER_` preserves its exact case
- Priority: Per-request headers > Authentication headers > Custom global headers

## Authentication Configuration

The tool supports four authentication methods. Configure one based on your API's requirements.

### Basic Authentication
- REST_BASIC_USERNAME: Username for Basic Auth
- REST_BASIC_PASSWORD: Password for Basic Auth
- Usage: When both are set, requests will include Basic Auth header

### Bearer Token
- REST_BEARER: Bearer token value
- Usage: When set, requests will include `Authorization: Bearer <token>` header

### API Key
- REST_APIKEY_HEADER_NAME: Name of the header for API key
- REST_APIKEY_VALUE: Value of the API key
- Example:
  ```
  REST_APIKEY_HEADER_NAME=X-API-Key
  REST_APIKEY_VALUE=your-api-key-here
  ```
- Usage: When both are set, requests will include the specified header with the API key

### Dynamic Bearer Token (Module)

If your API requires a custom flow to obtain a token, you can configure a local JavaScript module that exports an async function.

- AUTH_TOKEN_MODULE: Path to a local JS module file (`.mjs`/`.js`) that default-exports a function.
  - The server will `import()` this module at runtime.
  - The exported function is called with `{ axios, env }`:
    - `axios` is the **preconfigured Axios instance** used by the server (includes `baseURL` and SSL settings)
    - `env` is `process.env`
  - The function must return a **string token**.

Token refresh behavior:
- If the token looks like a JWT and includes an `exp` claim, the server will refresh it automatically shortly before it expires.
- If no `exp` is present, the token is cached for the lifetime of the server process.

Example module (`./get-token.mjs`):

```js
export default async function getToken({ axios, env }) {
  const res = await axios.post('/api/user/v1/auth/signin', {
    email: env.AUTH_EMAIL,
    password: env.AUTH_PASSWORD,
  });
  return res.data.token;
}
```

Example configuration:

```bash
REST_BASE_URL=http://localhost:8080
AUTH_TOKEN_MODULE=./get-token.mjs
AUTH_EMAIL=xxx@yyy.com
AUTH_PASSWORD=password@
```

## Configuration Examples

### Local Development
```bash
REST_BASE_URL=http://localhost:3000
REST_ENABLE_SSL_VERIFY=false
REST_RESPONSE_SIZE_LIMIT=50000
```

### Production API with Bearer Token
```bash
REST_BASE_URL=https://api.example.com
REST_BEARER=your-bearer-token
```

### API with Basic Auth
```bash
REST_BASE_URL=https://api.example.com
REST_BASIC_USERNAME=admin
REST_BASIC_PASSWORD=secret
```

### API with API Key
```bash
REST_BASE_URL=https://api.example.com
REST_APIKEY_HEADER_NAME=X-API-Key
REST_APIKEY_VALUE=your-api-key
```

### API with Custom Headers
```bash
REST_BASE_URL=https://api.example.com
HEADER_X-API-Version=2.0
HEADER_Custom-Client=my-client
HEADER_Accept=application/json
```

## Changing Configuration

Configuration can be updated by:
1. Setting environment variables before starting the server
2. Modifying the MCP server configuration file
3. Using environment variable commands in your terminal

Remember to restart the server after changing configuration for the changes to take effect.
