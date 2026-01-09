#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance, AxiosRequestConfig, Method } from 'axios';
import { VERSION, SERVER_NAME } from './version.js';

if (!process.env.REST_BASE_URL) {
  throw new Error('REST_BASE_URL environment variable is required');
}

// Default response size limit: 10KB (10000 bytes)
const RESPONSE_SIZE_LIMIT = process.env.REST_RESPONSE_SIZE_LIMIT 
  ? parseInt(process.env.REST_RESPONSE_SIZE_LIMIT, 10)
  : 10000;

if (isNaN(RESPONSE_SIZE_LIMIT) || RESPONSE_SIZE_LIMIT <= 0) {
  throw new Error('REST_RESPONSE_SIZE_LIMIT must be a positive number');
}
const AUTH_BASIC_USERNAME = process.env.AUTH_BASIC_USERNAME;
const AUTH_BASIC_PASSWORD = process.env.AUTH_BASIC_PASSWORD;
const AUTH_BEARER = process.env.AUTH_BEARER;
const AUTH_APIKEY_HEADER_NAME = process.env.AUTH_APIKEY_HEADER_NAME;
const AUTH_APIKEY_VALUE = process.env.AUTH_APIKEY_VALUE;
// Dynamic bearer token acquisition via local JS module (optional)
const AUTH_TOKEN_MODULE = process.env.AUTH_TOKEN_MODULE;
const REST_ENABLE_SSL_VERIFY = process.env.REST_ENABLE_SSL_VERIFY !== 'false';

interface EndpointArgs {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  body?: any;
  headers?: Record<string, string>;
  host?: string;
  // Free-form per-request options. Passed through to AUTH_TOKEN_MODULE as ctx.options.
  options?: Record<string, any>;
}

interface ValidationResult {
  isError: boolean;
  messages: string[];
  truncated?: {
    originalSize: number;
    returnedSize: number;
    truncationPoint: number;
    sizeLimit: number;
  };
}

// Function to sanitize headers by removing sensitive values and non-approved headers
const sanitizeHeaders = (
  headers: Record<string, any>,
  isFromOptionalParams: boolean = false
): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    // Always include headers from optional parameters
    if (isFromOptionalParams) {
      sanitized[key] = value;
      continue;
    }
    
    // Handle authentication headers
    if (
      lowerKey === 'authorization' ||
      (AUTH_APIKEY_HEADER_NAME && lowerKey === AUTH_APIKEY_HEADER_NAME.toLowerCase())
    ) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    
    // For headers from config/env
    const customHeaders = getCustomHeaders();
    if (key in customHeaders) {
      // Show value only for headers that are in the approved list
      const safeHeaders = new Set([
        'accept',
        'accept-language',
        'content-type',
        'user-agent',
        'cache-control',
        'if-match',
        'if-none-match',
        'if-modified-since',
        'if-unmodified-since'
      ]);
      const lowerKey = key.toLowerCase();
      sanitized[key] = safeHeaders.has(lowerKey) ? value : '[REDACTED]';
    }
  }
  
  return sanitized;
};

interface ResponseObject {
  request: {
    url: string;
    method: string;
    headers: Record<string, string | undefined>;
    body: any;
    authMethod: string;
  };
  response: {
    statusCode: number;
    statusText: string;
    timing: string;
    headers: Record<string, any>;
    body: any;
  };
  validation: ValidationResult;
}

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');

const isValidEndpointArgs = (args: any): args is EndpointArgs => {
  if (typeof args !== 'object' || args === null) return false;
  if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(args.method)) return false;
  if (typeof args.endpoint !== 'string') return false;
  if (args.headers !== undefined && (typeof args.headers !== 'object' || args.headers === null)) return false;
  
  // Check if endpoint contains a full URL
  const urlPattern = /^(https?:\/\/|www\.)/i;
  if (urlPattern.test(args.endpoint)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid endpoint format. Do not include full URLs. Instead of "${args.endpoint}", use just the path (e.g. "/api/users"). ` +
      `Your path will be resolved to: ${process.env.REST_BASE_URL}${args.endpoint.replace(/^\/+|\/+$/g, '')}. ` +
      `To test a different base URL, update the REST_BASE_URL environment variable.`
    );
  }
  // Validate .host if present
  if (args.host !== undefined) {
    try {
      const url = new URL(args.host);
      if (!/^https?:$/.test(url.protocol)) {
        throw new Error();
      }
      // Remove trailing slash if present
      if (url.pathname.endsWith('/') && url.pathname !== '/') {
        url.pathname = url.pathname.replace(/\/+$/, '');
        args.host = url.origin + url.pathname;
      } else {
        args.host = url.origin + url.pathname;
      }
    } catch (e) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid host format. The 'host' argument must be a valid URL starting with http:// or https://, e.g. "https://example.com" or "http://localhost:3001/api/v1". Received: "${args.host}"`);
    }
  }
  
  return true;
};

const hasBasicAuth = () => AUTH_BASIC_USERNAME && AUTH_BASIC_PASSWORD;
const hasBearerAuth = () => !!AUTH_BEARER;
const hasApiKeyAuth = () => AUTH_APIKEY_HEADER_NAME && AUTH_APIKEY_VALUE;
const hasDynamicBearerAuth = () => !!AUTH_TOKEN_MODULE;

const decodeBase64UrlToString = (input: string): string => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64').toString('utf8');
};

const getJwtExpMs = (token: string): number | undefined => {
  const parts = token.split('.');
  if (parts.length < 2) return undefined;
  try {
    const payloadJson = decodeBase64UrlToString(parts[1]);
    const payload = JSON.parse(payloadJson);
    const exp = payload?.exp;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return undefined;
    return exp * 1000;
  } catch {
    return undefined;
  }
};

class TokenProvider {
  private token?: string;
  private tokenExpiresAt?: number;
  private inflight?: Promise<string>;
  private tokenFn?: (ctx: {
    axios: AxiosInstance;
    env: NodeJS.ProcessEnv;
    options?: EndpointArgs['options'];
  }) => Promise<string> | string;
  private tokenFnInflight?: Promise<
    (ctx: {
      axios: AxiosInstance;
      env: NodeJS.ProcessEnv;
      options?: EndpointArgs['options'];
    }) => Promise<string> | string
  >;

  constructor(private axiosInstance: AxiosInstance) {}

  invalidate() {
    this.token = undefined;
    this.tokenExpiresAt = undefined;
  }

  async getToken(
    forceRefresh: boolean = false,
    options?: EndpointArgs['options']
  ): Promise<string> {
    const now = Date.now();

    // If per-request options are provided, treat them as a unique auth context.
    // To avoid cross-request/cross-user leakage, do not reuse cached/inflight tokens.
    const hasRequestOptions =
      !!options &&
      typeof options === 'object' &&
      Object.keys(options).length > 0;

    // If we know the token's expiry, refresh slightly before it actually expires.
    // This avoids edge cases where token expires mid-request.
    const refreshSkewMs = 60_000;
    const isValid =
      this.token &&
      (this.tokenExpiresAt === undefined || now < this.tokenExpiresAt - refreshSkewMs);

    // If per-request options are provided, never return a cached token.
    if (!forceRefresh && !hasRequestOptions && isValid) {
      return this.token as string;
    }

    // Avoid sharing inflight token acquisition across different per-request option contexts.
    if (!forceRefresh && !hasRequestOptions && this.inflight) {
      return await this.inflight;
    }

    const tokenPromise = this.acquireToken(options);
    if (!hasRequestOptions) {
      this.inflight = tokenPromise.finally(() => {
        this.inflight = undefined;
      });
    }

    const token = await tokenPromise;
    if (!hasRequestOptions) {
      this.token = token;
    }

    const expMs = getJwtExpMs(token);
    if (!hasRequestOptions) {
      this.tokenExpiresAt = expMs;
    }
    return token;
  }

  private async acquireToken(options?: EndpointArgs['options']): Promise<string> {
    if (!AUTH_TOKEN_MODULE) {
      throw new Error('Dynamic auth is enabled but AUTH_TOKEN_MODULE is not set');
    }

    const tokenFn = await this.getTokenFn();
    const token = await tokenFn({ axios: this.axiosInstance, env: process.env, options });
    const trimmed = String(token).trim();
    if (!trimmed) {
      throw new Error('AUTH_TOKEN_MODULE function returned empty token');
    }
    return trimmed;
  }

  private async getTokenFn(): Promise<
    (ctx: {
      axios: AxiosInstance;
      env: NodeJS.ProcessEnv;
      options?: EndpointArgs['options'];
    }) => Promise<string> | string
  > {
    if (this.tokenFn) return this.tokenFn;
    if (this.tokenFnInflight) return await this.tokenFnInflight;

    this.tokenFnInflight = (async () => {
      const path = await import('node:path');
      const url = await import('node:url');

      const modulePath = path.isAbsolute(AUTH_TOKEN_MODULE!)
        ? AUTH_TOKEN_MODULE!
        : path.resolve(process.cwd(), AUTH_TOKEN_MODULE!);

      const moduleUrl = url.pathToFileURL(modulePath).href;
      const mod: any = await import(moduleUrl);
      const fn = mod?.default;
      if (typeof fn !== 'function') {
        throw new Error('AUTH_TOKEN_MODULE must default-export a function');
      }
      this.tokenFn = fn;
      return fn;
    })().finally(() => {
      this.tokenFnInflight = undefined;
    });

    return await this.tokenFnInflight;
  }
}

// Collect custom headers from environment variables
const getCustomHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const headerPrefix = /^header_/i;  // Case-insensitive match for 'header_'
  
  for (const [key, value] of Object.entries(process.env)) {
    if (headerPrefix.test(key) && value !== undefined) {
      // Extract header name after the prefix, preserving case
      const headerName = key.replace(headerPrefix, '');
      headers[headerName] = value;
    }
  }
  
  return headers;
};

class RestTester {
  private server!: Server;
  private axiosInstance!: AxiosInstance;
  private tokenProvider?: TokenProvider;

  constructor() {
    this.setupServer();
  }

  private async setupServer() {
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: VERSION,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    const https = await import('https');
    this.axiosInstance = axios.create({
      baseURL: normalizeBaseUrl(process.env.REST_BASE_URL!),
      validateStatus: () => true, // Allow any status code
      httpsAgent: REST_ENABLE_SSL_VERIFY ? undefined : new https.Agent({ // Disable SSL verification only when explicitly set to false
        rejectUnauthorized: false
      })
    });

    if (hasDynamicBearerAuth()) {
      this.tokenProvider = new TokenProvider(this.axiosInstance);
    }

    this.setupToolHandlers();
    this.setupResourceHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: `${SERVER_NAME}://examples`,
          name: 'REST API Usage Examples',
          description: 'Detailed examples of using the REST API testing tool',
          mimeType: 'text/markdown'
        },
        {
          uri: `${SERVER_NAME}://response-format`,
          name: 'Response Format Documentation',
          description: 'Documentation of the response format and structure',
          mimeType: 'text/markdown'
        },
        {
          uri: `${SERVER_NAME}://config`,
          name: 'Configuration Documentation',
          description: 'Documentation of all configuration options and how to use them',
          mimeType: 'text/markdown'
        }
      ]
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uriPattern = new RegExp(`^${SERVER_NAME}://(.+)$`);
      const match = request.params.uri.match(uriPattern);
      
      if (!match) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Invalid resource URI format: ${request.params.uri}`
        );
      }

      const resource = match[1];
      const fs = await import('fs');
      const path = await import('path');

      try {
        const url = await import('url');
        const __filename = url.fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        // In the built app, resources are in build/resources
        // In development, they're in src/resources
        const resourcePath = path.join(__dirname, 'resources', `${resource}.md`);
        const content = await fs.promises.readFile(resourcePath, 'utf8');

        return {
          contents: [{
            uri: request.params.uri,
            mimeType: 'text/markdown',
            text: content
          }]
        };
      } catch (error) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Resource not found: ${resource}`
        );
      }
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'test_request',
          description: `Test a REST API endpoint and get detailed response information. Base URL: ${normalizeBaseUrl(process.env.REST_BASE_URL!)} | SSL Verification ${REST_ENABLE_SSL_VERIFY ? 'enabled' : 'disabled'} (see config resource for SSL settings) | Authentication: ${
  hasBasicAuth() ? 
    `Basic Auth with username: ${AUTH_BASIC_USERNAME}` :
  hasBearerAuth() ? 
    'Bearer token authentication configured' :
  hasApiKeyAuth() ? 
    `API Key using header: ${AUTH_APIKEY_HEADER_NAME}` :
  hasDynamicBearerAuth() ?
    'Dynamic Bearer token authentication configured (module)' :
    'No authentication configured'
} | ${(() => {
  const customHeaders = getCustomHeaders();
  if (Object.keys(customHeaders).length === 0) {
    return 'No custom headers defined (see config resource for headers)';
  }
  
  // List of common headers that are safe to show values for
  const safeHeaders = new Set([
    'accept',
    'accept-language',
    'content-type',
    'user-agent',
    'cache-control',
    'if-match',
    'if-none-match',
    'if-modified-since',
    'if-unmodified-since'
  ]);
  
  const headerList = Object.entries(customHeaders).map(([name, value]) => {
    const lowerName = name.toLowerCase();
    return safeHeaders.has(lowerName) ? 
      `${name}(${value})` : 
      name;
  }).join(', ');
  
  return `Custom headers defined: ${headerList} (see config resource for headers)`;
})()} | The tool automatically: - Normalizes endpoints (adds leading slash, removes trailing slashes) - Handles authentication header injection - Applies custom headers from HEADER_* environment variables - Accepts any HTTP status code as valid - Limits response size to ${RESPONSE_SIZE_LIMIT} bytes (see config resource for size limit settings) - Returns detailed response information including: * Full URL called * Status code and text * Response headers * Response body * Request details (method, headers, body) * Response timing * Validation messages | Error Handling: - Network errors are caught and returned with descriptive messages - Invalid status codes are still returned with full response details - Authentication errors include the attempted auth method | See the config resource for all configuration options, including header configuration.
`,
          inputSchema: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                description: 'HTTP method to use',
              },
              endpoint: {
                type: 'string',
                description: `Endpoint path (e.g. "/users"). Do not include full URLs - only the path. Example: "/api/users" will resolve to "${normalizeBaseUrl(process.env.REST_BASE_URL!)}/api/users"`,
              },
              body: {
                type: 'object',
                description: 'Optional request body for POST/PUT requests',
              },
              headers: {
                type: 'object',
                description: 'Optional request headers for one-time use. IMPORTANT: Do not use for sensitive data like API keys - those should be configured via environment variables. This parameter is intended for dynamic, non-sensitive headers that may be needed for specific requests.',
                additionalProperties: {
                  type: 'string'
                }
              },
              options: {
                type: 'object',
                description: 'Optional per-request options passed through to the dynamic bearer token module (AUTH_TOKEN_MODULE) as ctx.options. This object is free-form; its meaning is defined by your token module.',
                additionalProperties: true
              }
            },
            required: ['method', 'endpoint'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'test_request') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      if (!isValidEndpointArgs(request.params.arguments)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid test endpoint arguments'
        );
      }

      // Ensure endpoint starts with / and remove any trailing slashes
      const normalizedEndpoint = `/${request.params.arguments.endpoint.replace(/^\/+|\/+$/g, '')}`;
      
      const fullUrl = `${request.params.arguments.host || process.env.REST_BASE_URL}${normalizedEndpoint}`;
      // Initialize request config
      const config: AxiosRequestConfig = {
          method: request.params.arguments.method as Method,
          url: fullUrl,
          headers: {},
        };

      // Add request body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(request.params.arguments.method) && request.params.arguments.body) {
        config.data = request.params.arguments.body;
      }

      // Apply headers in order of priority (lowest to highest)
      
      // 1. Custom global headers (lowest priority)
      const customHeaders = getCustomHeaders();
      config.headers = {
        ...customHeaders,
        ...config.headers,
        ...(request.params.arguments.headers || {}) // Request-specific headers (middle priority)
      };

      // 3. Authentication headers (highest priority)
      if (hasBasicAuth()) {
        const base64Credentials = Buffer.from(`${AUTH_BASIC_USERNAME}:${AUTH_BASIC_PASSWORD}`).toString('base64');
        config.headers = {
          ...config.headers,
          'Authorization': `Basic ${base64Credentials}`
        };
      } else if (hasBearerAuth()) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${AUTH_BEARER}`
        };
      } else if (hasApiKeyAuth()) {
        config.headers = {
          ...config.headers,
          [AUTH_APIKEY_HEADER_NAME as string]: AUTH_APIKEY_VALUE
        };
      } else if (this.tokenProvider) {
        const token = await this.tokenProvider.getToken(false, request.params.arguments.options);
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${token}`
        };
      }

      try {
        const startTime = Date.now();
        const response = await this.axiosInstance.request(config);
        const endTime = Date.now();

        // Determine auth method used
        let authMethod = 'none';
        if (hasBasicAuth()) authMethod = 'basic';
        else if (hasBearerAuth()) authMethod = 'bearer';
        else if (hasApiKeyAuth()) authMethod = 'apikey';
        else if (this.tokenProvider) authMethod = 'dynamic_bearer';

        // Prepare response object
        const responseObj: ResponseObject = {
          request: {
            url: fullUrl,
            method: config.method || 'GET',
            headers: {
              ...sanitizeHeaders(config.headers as Record<string, string | undefined>, false),
              ...sanitizeHeaders(request.params.arguments.headers || {}, true)
            },
            body: config.data,
            authMethod
          },
          response: {
            statusCode: response.status,
            statusText: response.statusText,
            timing: `${endTime - startTime}ms`,
            headers: sanitizeHeaders(response.headers as Record<string, any>, false),
            body: response.data,
          },
          validation: {
            isError: response.status >= 400,
            messages: response.status >= 400 ? 
              [`Request failed with status ${response.status}`] : 
              ['Request completed successfully']
          }
        };

        // Check response body size independently
        const bodyStr = typeof response.data === 'string' 
          ? response.data 
          : JSON.stringify(response.data);
        const bodySize = Buffer.from(bodyStr).length;

        if (bodySize > RESPONSE_SIZE_LIMIT) {
          // Simply truncate to the size limit
          responseObj.response.body = bodyStr.slice(0, RESPONSE_SIZE_LIMIT);
          responseObj.validation.messages.push(
            `Response truncated: ${RESPONSE_SIZE_LIMIT} of ${bodySize} bytes returned due to size limit (${RESPONSE_SIZE_LIMIT} bytes)`
          );
          responseObj.validation.truncated = {
            originalSize: bodySize,
            returnedSize: RESPONSE_SIZE_LIMIT,
            truncationPoint: RESPONSE_SIZE_LIMIT,
            sizeLimit: RESPONSE_SIZE_LIMIT
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(responseObj, null, 2),
            },
          ],
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          return {
            content: [
              {
                type: 'text',
              text: JSON.stringify({
                error: {
                  message: error.message,
                  code: error.code,
                  request: {
                    url: `${process.env.REST_BASE_URL}${normalizedEndpoint}`,
                    method: config.method,
                    headers: {
                      ...sanitizeHeaders(config.headers as Record<string, string | undefined>, false),
                      ...sanitizeHeaders(request.params.arguments.headers || {}, true)
                    },
                    body: config.data
                  }
                }
              }, null, 2),
              },
            ],
            isError: true,
          };
        }
        throw error;
      }
    });
  }

  async run() {
    await this.setupServer();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('REST API Tester MCP server running on stdio');
  }
}

const server = new RestTester();
server.run().catch(console.error);
