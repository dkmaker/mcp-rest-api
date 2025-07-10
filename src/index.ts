#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { type AxiosInstance, type AxiosRequestConfig, type Method } from 'axios';
import { SERVER_NAME, VERSION } from './version.js';

// REST_BASE_URL is now optional - if not set, endpoints must be full URLs

/**
 * Configuration constants
 */
const CONFIG = {
  /** Default response size limit: 10KB (10000 bytes) */
  DEFAULT_RESPONSE_SIZE_LIMIT: 10000,
  /** Maximum response size limit: 50MB (52428800 bytes) */
  MAX_RESPONSE_SIZE_LIMIT: 52428800,
  /** Header prefix for custom headers from environment variables */
  HEADER_PREFIX: /^header_/i,
  /** URL pattern to detect full URLs */
  URL_PATTERN: /^(https?:\/\/|www\.)/i,
  /** Safe headers that can show values in logs */
  SAFE_HEADERS: new Set([
    'accept',
    'accept-language',
    'content-type',
    'user-agent',
    'cache-control',
    'if-match',
    'if-none-match',
    'if-modified-since',
    'if-unmodified-since',
  ]),
  /** Sensitive headers that should never be logged */
  SENSITIVE_HEADERS: new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'proxy-authorization',
    'www-authenticate',
  ]),
  /** Maximum number of concurrent requests */
  MAX_CONCURRENT_REQUESTS: 10,
  /** Request timeout in milliseconds */
  REQUEST_TIMEOUT: 30000,
  /** Maximum URL length to prevent DoS */
  MAX_URL_LENGTH: 2048,
  /** Maximum header value length */
  MAX_HEADER_VALUE_LENGTH: 8192,
  /** Maximum number of custom headers */
  MAX_CUSTOM_HEADERS: 50,
  /** Rate limiting window in milliseconds */
  RATE_LIMIT_WINDOW: 60000,
  /** Maximum requests per window */
  MAX_REQUESTS_PER_WINDOW: 100,
} as const;

/**
 * Response size limit from environment or default
 * Can be overridden by setting REST_RESPONSE_SIZE_LIMIT environment variable
 */
const RESPONSE_SIZE_LIMIT = process.env.REST_RESPONSE_SIZE_LIMIT
  ? Number.parseInt(process.env.REST_RESPONSE_SIZE_LIMIT, 10)
  : CONFIG.DEFAULT_RESPONSE_SIZE_LIMIT;

if (Number.isNaN(RESPONSE_SIZE_LIMIT) || RESPONSE_SIZE_LIMIT <= 0) {
  throw new Error(
    `REST_RESPONSE_SIZE_LIMIT must be a positive number. Received: ${process.env.REST_RESPONSE_SIZE_LIMIT}`
  );
}

if (RESPONSE_SIZE_LIMIT > CONFIG.MAX_RESPONSE_SIZE_LIMIT) {
  throw new Error(
    `REST_RESPONSE_SIZE_LIMIT cannot exceed ${CONFIG.MAX_RESPONSE_SIZE_LIMIT} bytes for security reasons. Received: ${RESPONSE_SIZE_LIMIT}`
  );
}

/**
 * Authentication configuration from environment variables
 */
const AUTH = {
  BASIC_USERNAME: process.env.AUTH_BASIC_USERNAME,
  BASIC_PASSWORD: process.env.AUTH_BASIC_PASSWORD,
  BEARER: process.env.AUTH_BEARER,
  APIKEY_HEADER_NAME: process.env.AUTH_APIKEY_HEADER_NAME,
  APIKEY_VALUE: process.env.AUTH_APIKEY_VALUE,
} as const;

/**
 * SSL verification setting
 */
const REST_ENABLE_SSL_VERIFY = process.env.REST_ENABLE_SSL_VERIFY !== 'false';

/**
 * Performance monitoring configuration
 */
const ENABLE_PERFORMANCE_MONITORING =
  process.env.NODE_ENV === 'development' || process.env.ENABLE_PERFORMANCE_MONITORING === 'true';

/**
 * Security configuration
 */
const SECURITY_CONFIG = {
  /** Enable security headers */
  ENABLE_SECURITY_HEADERS: process.env.DISABLE_SECURITY_HEADERS !== 'true',
  /** Enable detailed error messages (only in development) */
  ENABLE_DETAILED_ERRORS: process.env.NODE_ENV === 'development',
  /** Enable request logging for security monitoring */
  ENABLE_SECURITY_LOGGING: process.env.ENABLE_SECURITY_LOGGING === 'true',
} as const;

/**
 * Performance metrics collector
 */
class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordMetric(name: string, value: number): void {
    if (!ENABLE_PERFORMANCE_MONITORING) return;

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const values = this.metrics.get(name)!;
    values.push(value);

    // Keep only last 100 measurements to prevent memory leaks
    if (values.length > 100) {
      values.shift();
    }
  }

  getMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    for (const [name, values] of this.metrics) {
      if (values.length === 0) continue;

      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      result[name] = { avg, min, max, count: values.length };
    }

    return result;
  }

  logMetrics(): void {
    if (!ENABLE_PERFORMANCE_MONITORING) return;

    const metrics = this.getMetrics();
    if (Object.keys(metrics).length === 0) return;

    console.log('\n=== Performance Metrics ===');
    for (const [name, stats] of Object.entries(metrics)) {
      console.log(
        `${name}: avg=${stats.avg.toFixed(2)}ms, min=${stats.min.toFixed(2)}ms, max=${stats.max.toFixed(2)}ms, count=${stats.count}`
      );
    }
    console.log('===========================\n');
  }
}

/**
 * HTTP methods supported by the REST API tester
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Arguments for REST API endpoint testing
 */
interface EndpointArgs {
  /** HTTP method to use for the request */
  method: HttpMethod;
  /** Endpoint URL or path */
  endpoint: string;
  /** Optional request body for POST/PUT/PATCH requests */
  body?: unknown;
  /** Optional request headers */
  headers?: Record<string, string>;
  /** Optional host to override base URL */
  host?: string;
}

/**
 * Result of response validation and processing
 */
interface ValidationResult {
  /** Whether the response indicates an error (status >= 400) */
  isError: boolean;
  /** Validation and processing messages */
  messages: string[];
  /** Information about response truncation due to size limits */
  truncated?: {
    /** Original response size in bytes */
    originalSize: number;
    /** Actual returned size in bytes */
    returnedSize: number;
    /** Point where truncation occurred */
    truncationPoint: number;
    /** Configured size limit */
    sizeLimit: number;
  };
}

/**
 * Cached sanitized headers to avoid repeated processing
 */
const sanitizedHeadersCache = new Map<string, Record<string, unknown>>();

/**
 * Sanitize headers by removing sensitive values and non-approved headers
 * @param headers - Headers to sanitize
 * @param isFromOptionalParams - Whether headers come from optional parameters (affects sanitization)
 * @returns Sanitized headers with sensitive values redacted
 */
const sanitizeHeaders = (headers: Record<string, unknown>, isFromOptionalParams = false): Record<string, unknown> => {
  // Create a cache key based on header keys and values (excluding sensitive data)
  const cacheKey = isFromOptionalParams ? `optional_${Object.keys(headers).join(',')}` : Object.keys(headers).join(',');

  // Return cached result if available for non-optional headers
  if (!isFromOptionalParams && sanitizedHeadersCache.has(cacheKey)) {
    return sanitizedHeadersCache.get(cacheKey)!;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    // Check if this is a sensitive header that should be redacted
    if (CONFIG.SENSITIVE_HEADERS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Always include headers from optional parameters (but still redact sensitive ones)
    if (isFromOptionalParams) {
      sanitized[key] = value;
      continue;
    }

    // Handle authentication headers
    if (
      lowerKey === 'authorization' ||
      (AUTH.APIKEY_HEADER_NAME && lowerKey === AUTH.APIKEY_HEADER_NAME.toLowerCase())
    ) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // For headers from config/env
    const customHeaders = getCustomHeaders();
    if (key in customHeaders) {
      // Show value only for headers that are in the approved list
      sanitized[key] = CONFIG.SAFE_HEADERS.has(lowerKey) ? value : '[REDACTED]';
    }
  }

  // Cache the result for non-optional headers
  if (!isFromOptionalParams && sanitizedHeadersCache.size < 100) {
    sanitizedHeadersCache.set(cacheKey, sanitized);
  }

  return sanitized;
};

/**
 * Authentication methods supported by the server
 */
type AuthMethod = 'none' | 'basic' | 'bearer' | 'apikey';

/**
 * Complete response object returned by the test_request tool
 */
interface ResponseObject {
  /** Information about the request that was made */
  request: {
    /** Full URL that was called */
    url: string;
    /** HTTP method used */
    method: string;
    /** Headers sent with the request (sensitive values redacted) */
    headers: Record<string, unknown>;
    /** Request body that was sent */
    body: unknown;
    /** Authentication method used */
    authMethod: AuthMethod;
  };
  /** Information about the response received */
  response: {
    /** HTTP status code */
    statusCode: number;
    /** HTTP status text */
    statusText: string;
    /** Request timing in milliseconds */
    timing: string;
    /** Response headers (sensitive values redacted) */
    headers: Record<string, unknown>;
    /** Response body */
    body: unknown;
  };
  /** Validation results and processing information */
  validation: ValidationResult;
}

/**
 * Normalize base URL by removing trailing slashes
 * @param url - URL to normalize
 * @returns Normalized URL without trailing slashes
 */
const normalizeBaseUrl = (url: string | undefined): string => (url ? url.replace(/\/+$/, '') : '');

/**
 * Validate and sanitize input strings to prevent injection attacks
 * @param input - Input string to validate
 * @param maxLength - Maximum allowed length
 * @param allowedChars - Regex pattern for allowed characters
 * @returns Sanitized string
 * @throws McpError if validation fails
 */
const validateAndSanitizeInput = (input: string, maxLength: number, allowedChars?: RegExp): string => {
  if (typeof input !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'Input must be a string');
  }

  if (input.length > maxLength) {
    throw new McpError(ErrorCode.InvalidParams, `Input exceeds maximum length of ${maxLength} characters`);
  }

  if (allowedChars && !allowedChars.test(input)) {
    throw new McpError(ErrorCode.InvalidParams, 'Input contains invalid characters');
  }

  // Remove null bytes and control characters (except common whitespace)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: This regex is intentionally used for security sanitization
  const sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
};

/**
 * Validate endpoint arguments and ensure proper URL format
 * @param args - Arguments to validate
 * @returns True if arguments are valid EndpointArgs
 * @throws McpError if validation fails
 */
const isValidEndpointArgs = (args: unknown): args is EndpointArgs => {
  if (typeof args !== 'object' || args === null) return false;
  if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes((args as any).method)) return false;
  if (typeof (args as any).endpoint !== 'string') return false;

  // Validate endpoint length
  const endpoint = validateAndSanitizeInput((args as any).endpoint, CONFIG.MAX_URL_LENGTH);
  (args as any).endpoint = endpoint;

  // Validate headers if present
  if ((args as any).headers !== undefined) {
    if (typeof (args as any).headers !== 'object' || (args as any).headers === null) {
      return false;
    }

    const headers = (args as any).headers;
    const headerCount = Object.keys(headers).length;

    if (headerCount > CONFIG.MAX_CUSTOM_HEADERS) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Too many headers. Maximum allowed: ${CONFIG.MAX_CUSTOM_HEADERS}, received: ${headerCount}`
      );
    }

    // Validate each header
    for (const [key, value] of Object.entries(headers)) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'Header keys and values must be strings');
      }

      validateAndSanitizeInput(key, 256, /^[a-zA-Z0-9_-]+$/);
      validateAndSanitizeInput(value, CONFIG.MAX_HEADER_VALUE_LENGTH);
    }
  }

  // Check if endpoint contains a full URL
  const isFullUrl = CONFIG.URL_PATTERN.test((args as any).endpoint);

  // If REST_BASE_URL is not configured, endpoint must be a full URL
  if (!process.env.REST_BASE_URL && !isFullUrl) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `REST_BASE_URL is not configured. Either set REST_BASE_URL environment variable or provide a full URL in the endpoint parameter (e.g. "https://api.example.com/users").`
    );
  }

  // If REST_BASE_URL is configured, endpoint should be a path (not full URL)
  if (process.env.REST_BASE_URL && isFullUrl) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `REST_BASE_URL is configured. Do not include full URLs in the endpoint parameter. Instead of "${(args as any).endpoint}", use just the path (e.g. "/api/users"). Your path will be resolved to: ${process.env.REST_BASE_URL}${(args as any).endpoint.replace(/^\/+|\/+$/g, '')}. To test a different base URL, use the 'host' parameter or update the REST_BASE_URL environment variable.`
    );
  }

  // Validate .host if present
  if ((args as any).host !== undefined) {
    const hostInput = validateAndSanitizeInput((args as any).host, CONFIG.MAX_URL_LENGTH);

    try {
      const url = new URL(hostInput);
      if (!/^https?:$/.test(url.protocol)) {
        throw new Error();
      }

      // Validate hostname to prevent SSRF attacks
      const hostname = url.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('172.')
      ) {
        if (process.env.NODE_ENV !== 'development' && process.env.ALLOW_PRIVATE_NETWORKS !== 'true') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Private network access is not allowed in production environments'
          );
        }
      }

      // Remove trailing slash if present
      if (url.pathname.endsWith('/') && url.pathname !== '/') {
        url.pathname = url.pathname.replace(/\/+$/, '');
        (args as any).host = url.origin + url.pathname;
      } else {
        (args as any).host = url.origin + url.pathname;
      }
    } catch (e) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid host format. The 'host' argument must be a valid URL starting with http:// or https://, e.g. "https://example.com" or "http://localhost:3001/api/v1". Received: "${(args as any).host}"`
      );
    }
  }

  return true;
};

/**
 * Check if basic authentication is configured
 * @returns True if both username and password are set
 */
const hasBasicAuth = () => AUTH.BASIC_USERNAME && AUTH.BASIC_PASSWORD;

/**
 * Check if bearer token authentication is configured
 * @returns True if bearer token is set
 */
const hasBearerAuth = () => !!AUTH.BEARER;

/**
 * Check if API key authentication is configured
 * @returns True if both header name and value are set
 */
const hasApiKeyAuth = () => AUTH.APIKEY_HEADER_NAME && AUTH.APIKEY_VALUE;

/**
 * Cached custom headers to avoid repeated environment variable parsing
 */
let customHeadersCache: Record<string, string> | null = null;

/**
 * Collect custom headers from environment variables
 * Looks for environment variables prefixed with 'HEADER_' (case-insensitive)
 * @returns Object containing custom headers
 */
const getCustomHeaders = (): Record<string, string> => {
  if (customHeadersCache !== null) {
    return customHeadersCache;
  }

  const headers: Record<string, string> = {};
  let headerCount = 0;

  for (const [key, value] of Object.entries(process.env)) {
    if (CONFIG.HEADER_PREFIX.test(key) && value !== undefined) {
      // Security check: limit number of custom headers
      if (headerCount >= CONFIG.MAX_CUSTOM_HEADERS) {
        console.warn(
          `[Security] Maximum custom headers limit (${CONFIG.MAX_CUSTOM_HEADERS}) reached. Skipping additional headers.`
        );
        break;
      }

      // Extract header name after the prefix, preserving case
      const headerName = key.replace(CONFIG.HEADER_PREFIX, '');

      // Validate header name and value
      try {
        validateAndSanitizeInput(headerName, 256, /^[a-zA-Z0-9_-]+$/);
        validateAndSanitizeInput(value, CONFIG.MAX_HEADER_VALUE_LENGTH);

        headers[headerName] = value;
        headerCount++;
      } catch (error) {
        console.warn(
          `[Security] Invalid header ${key} skipped:`,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

  customHeadersCache = headers;
  return headers;
};

/**
 * Request rate limiter to prevent excessive concurrent requests and DoS attacks
 */
class RequestLimiter {
  private activeRequests = 0;
  private maxConcurrent: number;
  private requestHistory: Map<string, number[]> = new Map();
  private maxRequestsPerWindow: number;
  private windowMs: number;

  constructor(
    maxConcurrent: number = CONFIG.MAX_CONCURRENT_REQUESTS,
    maxRequestsPerWindow: number = CONFIG.MAX_REQUESTS_PER_WINDOW,
    windowMs: number = CONFIG.RATE_LIMIT_WINDOW
  ) {
    this.maxConcurrent = maxConcurrent;
    this.maxRequestsPerWindow = maxRequestsPerWindow;
    this.windowMs = windowMs;

    // Clean up old entries periodically
    setInterval(() => this.cleanupHistory(), this.windowMs);
  }

  async acquire(clientId = 'default'): Promise<void> {
    // Check rate limiting first
    if (!this.checkRateLimit(clientId)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Rate limit exceeded. Maximum ${this.maxRequestsPerWindow} requests per ${this.windowMs / 1000} seconds.`
      );
    }

    // Wait for available slot
    let attempts = 0;
    while (this.activeRequests >= this.maxConcurrent) {
      if (attempts > 100) {
        // Prevent infinite waiting
        throw new McpError(ErrorCode.InvalidRequest, 'Server too busy. Please try again later.');
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      attempts++;
    }

    this.activeRequests++;
    this.recordRequest(clientId);
  }

  release(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const requests = this.requestHistory.get(clientId) || [];

    // Filter requests within the current window
    const validRequests = requests.filter((timestamp) => now - timestamp < this.windowMs);

    return validRequests.length < this.maxRequestsPerWindow;
  }

  private recordRequest(clientId: string): void {
    const now = Date.now();
    if (!this.requestHistory.has(clientId)) {
      this.requestHistory.set(clientId, []);
    }

    const requests = this.requestHistory.get(clientId)!;
    requests.push(now);

    // Keep only recent requests
    this.requestHistory.set(
      clientId,
      requests.filter((timestamp) => now - timestamp < this.windowMs)
    );
  }

  private cleanupHistory(): void {
    const now = Date.now();
    for (const [clientId, requests] of this.requestHistory) {
      const validRequests = requests.filter((timestamp) => now - timestamp < this.windowMs);
      if (validRequests.length === 0) {
        this.requestHistory.delete(clientId);
      } else {
        this.requestHistory.set(clientId, validRequests);
      }
    }
  }
}

/**
 * Main MCP server class for REST API testing
 * Provides a single tool 'test_request' for making HTTP requests with authentication
 */
class RestTester {
  /** MCP server instance */
  private server!: Server;
  /** Axios instance for making HTTP requests */
  private axiosInstance!: AxiosInstance;
  /** Request rate limiter */
  private requestLimiter: RequestLimiter;

  /**
   * Create a new RestTester instance
   * Automatically sets up the server on construction
   */
  constructor() {
    this.requestLimiter = new RequestLimiter();
    this.setupServer();
  }

  /**
   * Set up the MCP server with capabilities, tools, and resources
   * Configures axios instance with authentication and SSL settings
   */
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

    const https = await import('node:https');
    const axiosConfig: any = {
      validateStatus: () => true, // Allow any status code
      timeout: CONFIG.REQUEST_TIMEOUT,
      maxRedirects: 5,
      httpsAgent: REST_ENABLE_SSL_VERIFY
        ? undefined
        : new https.Agent({
            // Disable SSL verification only when explicitly set to false
            rejectUnauthorized: false,
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: CONFIG.MAX_CONCURRENT_REQUESTS,
          }),
    };

    if (process.env.REST_BASE_URL) {
      axiosConfig.baseURL = normalizeBaseUrl(process.env.REST_BASE_URL);
    }

    this.axiosInstance = axios.create(axiosConfig);

    this.setupToolHandlers();
    this.setupResourceHandlers();

    this.server.onerror = (error) => {
      // Log security-relevant errors
      if (SECURITY_CONFIG.ENABLE_SECURITY_LOGGING) {
        console.error('[MCP Security Error]', {
          timestamp: new Date().toISOString(),
          error: SECURITY_CONFIG.ENABLE_DETAILED_ERRORS ? error : 'Error details redacted in production',
        });
      } else {
        console.error('[MCP Error]', SECURITY_CONFIG.ENABLE_DETAILED_ERRORS ? error : 'Error occurred');
      }
    };
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Set up resource handlers for documentation and examples
   * Provides access to configuration docs, examples, and response format info
   */
  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: `${SERVER_NAME}://examples`,
          name: 'REST API Usage Examples',
          description: 'Detailed examples of using the REST API testing tool',
          mimeType: 'text/markdown',
        },
        {
          uri: `${SERVER_NAME}://response-format`,
          name: 'Response Format Documentation',
          description: 'Documentation of the response format and structure',
          mimeType: 'text/markdown',
        },
        {
          uri: `${SERVER_NAME}://config`,
          name: 'Configuration Documentation',
          description: 'Documentation of all configuration options and how to use them',
          mimeType: 'text/markdown',
        },
        {
          uri: `${SERVER_NAME}://security`,
          name: 'Security Configuration and Best Practices',
          description: 'Security features, configurations, and best practices for the MCP REST API server',
          mimeType: 'text/markdown',
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uriPattern = new RegExp(`^${SERVER_NAME}://(.+)$`);
      const match = request.params.uri.match(uriPattern);

      if (!match) {
        throw new McpError(ErrorCode.InvalidRequest, `Invalid resource URI format: ${request.params.uri}`);
      }

      const resource = match[1];
      const fs = await import('node:fs');
      const path = await import('node:path');

      try {
        const url = await import('node:url');
        const __filename = url.fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        // In the built app, resources are in build/resources
        // In development, they're in src/resources
        const resourcePath = path.join(__dirname, 'resources', `${resource}.md`);
        const content = await fs.promises.readFile(resourcePath, 'utf8');

        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: 'text/markdown',
              text: content,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new McpError(ErrorCode.InvalidRequest, `Resource not found: ${resource}. Error: ${errorMessage}`);
      }
    });
  }

  /**
   * Set up tool handlers for the test_request tool
   * Handles HTTP request execution with authentication and response processing
   */
  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'test_request',
          description: `Test a REST API endpoint and get detailed response information. Base URL: ${process.env.REST_BASE_URL ? normalizeBaseUrl(process.env.REST_BASE_URL) : 'Not configured - use full URLs in endpoint parameter'} | SSL Verification ${REST_ENABLE_SSL_VERIFY ? 'enabled' : 'disabled'} (see config resource for SSL settings) | Authentication: ${
            hasBasicAuth()
              ? `Basic Auth with username: ${AUTH.BASIC_USERNAME}`
              : hasBearerAuth()
                ? 'Bearer token authentication configured'
                : hasApiKeyAuth()
                  ? `API Key using header: ${AUTH.APIKEY_HEADER_NAME}`
                  : 'No authentication configured'
          } | ${(() => {
            const customHeaders = getCustomHeaders();
            if (Object.keys(customHeaders).length === 0) {
              return 'No custom headers defined (see config resource for headers)';
            }

            const headerList = Object.entries(customHeaders)
              .map(([name, value]) => {
                const lowerName = name.toLowerCase();
                return CONFIG.SAFE_HEADERS.has(lowerName) ? `${name}(${value})` : name;
              })
              .join(', ');

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
                description: process.env.REST_BASE_URL
                  ? `Endpoint path (e.g. "/users"). Do not include full URLs - only the path. Example: "/api/users" will resolve to "${normalizeBaseUrl(process.env.REST_BASE_URL)}/api/users"`
                  : `Full URL (e.g. "https://api.example.com/users") since REST_BASE_URL is not configured. You can also use paths if you provide the 'host' parameter.`,
              },
              body: {
                type: 'object',
                description: 'Optional request body for POST/PUT requests',
              },
              headers: {
                type: 'object',
                description:
                  'Optional request headers for one-time use. IMPORTANT: Do not use for sensitive data like API keys - those should be configured via environment variables. This parameter is intended for dynamic, non-sensitive headers that may be needed for specific requests.',
                additionalProperties: {
                  type: 'string',
                },
              },
            },
            required: ['method', 'endpoint'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'test_request') {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      }

      if (!isValidEndpointArgs(request.params.arguments)) {
        throw new McpError(ErrorCode.InvalidParams, 'Invalid test endpoint arguments');
      }

      // Determine the full URL based on whether REST_BASE_URL is configured and endpoint format
      let fullUrl: string;
      const isFullUrl = CONFIG.URL_PATTERN.test(request.params.arguments.endpoint);

      if (isFullUrl) {
        // Endpoint is already a full URL
        fullUrl = request.params.arguments.endpoint;
      } else {
        // Endpoint is a path, combine with base URL or host
        const normalizedEndpoint = `/${request.params.arguments.endpoint.replace(/^\/+|\/+$/g, '')}`;
        const baseUrl = request.params.arguments.host || process.env.REST_BASE_URL;
        fullUrl = `${baseUrl}${normalizedEndpoint}`;
      }
      // Initialize request config with pre-allocated headers
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
      // Use Object.assign for better performance than spread operator

      // Ensure headers object exists
      if (!config.headers) {
        config.headers = {};
      }

      // 1. Custom global headers (lowest priority)
      const customHeaders = getCustomHeaders();
      Object.assign(config.headers, customHeaders);

      // 2. Request-specific headers (middle priority)
      if (request.params.arguments.headers) {
        Object.assign(config.headers, request.params.arguments.headers);
      }

      // 3. Authentication headers (highest priority)
      if (hasBasicAuth()) {
        const base64Credentials = Buffer.from(`${AUTH.BASIC_USERNAME}:${AUTH.BASIC_PASSWORD}`).toString('base64');
        (config.headers as any).Authorization = `Basic ${base64Credentials}`;
      } else if (hasBearerAuth()) {
        (config.headers as any).Authorization = `Bearer ${AUTH.BEARER}`;
      } else if (hasApiKeyAuth()) {
        (config.headers as any)[AUTH.APIKEY_HEADER_NAME as string] = AUTH.APIKEY_VALUE;
      }

      try {
        // Acquire rate limiter before making request
        await this.requestLimiter.acquire();

        const startTime = performance.now();
        const response = await this.axiosInstance.request(config);
        const endTime = performance.now();

        // Release rate limiter after request completion
        this.requestLimiter.release();

        // Security logging
        if (SECURITY_CONFIG.ENABLE_SECURITY_LOGGING) {
          console.log(`[Security] Request completed: ${config.method} ${fullUrl} - Status: ${response.status}`);
        }

        // Record performance metrics
        const requestTime = endTime - startTime;
        const perfMonitor = PerformanceMonitor.getInstance();
        perfMonitor.recordMetric('request_duration', requestTime);
        perfMonitor.recordMetric(
          'response_size',
          response.headers['content-length'] ? Number.parseInt(response.headers['content-length'] as string, 10) : 0
        );

        // Determine auth method used
        let authMethod: AuthMethod = 'none';
        if (hasBasicAuth()) authMethod = 'basic';
        else if (hasBearerAuth()) authMethod = 'bearer';
        else if (hasApiKeyAuth()) authMethod = 'apikey';

        // Prepare response object
        const responseObj: ResponseObject = {
          request: {
            url: fullUrl,
            method: config.method || 'GET',
            headers: {
              ...sanitizeHeaders((config.headers as Record<string, unknown>) || {}, false),
              ...sanitizeHeaders(request.params.arguments.headers || {}, true),
            },
            body: config.data,
            authMethod,
          },
          response: {
            statusCode: response.status,
            statusText: response.statusText,
            timing: `${requestTime.toFixed(2)}ms`,
            headers: sanitizeHeaders(response.headers as Record<string, unknown>, false),
            body: response.data,
          },
          validation: {
            isError: response.status >= 400,
            messages:
              response.status >= 400
                ? [`Request failed with status ${response.status}`]
                : ['Request completed successfully'],
          },
        };

        // Check response body size efficiently
        let bodyStr: string;
        let bodySize: number;

        if (typeof response.data === 'string') {
          bodyStr = response.data;
          bodySize = Buffer.byteLength(bodyStr, 'utf8');
        } else {
          bodyStr = JSON.stringify(response.data);
          bodySize = Buffer.byteLength(bodyStr, 'utf8');
        }

        if (bodySize > RESPONSE_SIZE_LIMIT) {
          // Efficiently truncate to the size limit
          let truncated = bodyStr;
          let currentSize = bodySize;

          while (currentSize > RESPONSE_SIZE_LIMIT && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
            currentSize = Buffer.byteLength(truncated, 'utf8');
          }

          responseObj.response.body = truncated;
          responseObj.validation.messages.push(
            `Response truncated: ${currentSize} of ${bodySize} bytes returned due to size limit (${RESPONSE_SIZE_LIMIT} bytes)`
          );
          responseObj.validation.truncated = {
            originalSize: bodySize,
            returnedSize: currentSize,
            truncationPoint: currentSize,
            sizeLimit: RESPONSE_SIZE_LIMIT,
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
        // Always release rate limiter in case of error
        this.requestLimiter.release();

        // Security logging for errors
        if (SECURITY_CONFIG.ENABLE_SECURITY_LOGGING) {
          console.error(`[Security] Request failed: ${config.method} ${fullUrl}`, {
            error: SECURITY_CONFIG.ENABLE_DETAILED_ERRORS ? error : 'Error details redacted',
            timestamp: new Date().toISOString(),
          });
        }

        if (axios.isAxiosError(error)) {
          // Sanitize error messages to prevent information leakage
          const sanitizedError = {
            message: SECURITY_CONFIG.ENABLE_DETAILED_ERRORS ? error.message : 'Request failed',
            code: error.code,
            status: error.response?.status,
            request: {
              url: SECURITY_CONFIG.ENABLE_DETAILED_ERRORS ? fullUrl : '[URL REDACTED]',
              method: config.method,
              headers: {
                ...sanitizeHeaders((config.headers as Record<string, unknown>) || {}, false),
                ...sanitizeHeaders(request.params.arguments.headers || {}, true),
              },
              body: SECURITY_CONFIG.ENABLE_DETAILED_ERRORS ? config.data : '[BODY REDACTED]',
            },
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: sanitizedError,
                    timestamp: new Date().toISOString(),
                    security: {
                      message: 'Error details may be limited for security reasons',
                      detailedLogging: SECURITY_CONFIG.ENABLE_DETAILED_ERRORS,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // For non-axios errors, provide minimal information
        const genericError = {
          message: SECURITY_CONFIG.ENABLE_DETAILED_ERRORS
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : 'An error occurred while processing the request',
          timestamp: new Date().toISOString(),
          security: {
            message: 'Error details limited for security reasons',
            detailedLogging: SECURITY_CONFIG.ENABLE_DETAILED_ERRORS,
          },
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(genericError, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Start the MCP server and begin listening for requests
   * Connects to stdio transport and logs startup message
   */
  async run() {
    await this.setupServer();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('REST API Tester MCP server running on stdio');

    // Start performance monitoring logging (development mode only)
    if (ENABLE_PERFORMANCE_MONITORING) {
      const perfMonitor = PerformanceMonitor.getInstance();
      setInterval(() => {
        perfMonitor.logMetrics();
      }, 30000); // Log every 30 seconds
    }
  }
}

const server = new RestTester();
server.run().catch(console.error);
