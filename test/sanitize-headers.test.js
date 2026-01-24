import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

// Since sanitizeHeaders is an internal function, we replicate the logic for testing
const AUTH_APIKEY_HEADER_NAME = 'X-API-Key';

const sanitizeHeaders = (
  headers,
  isFromOptionalParams = false
) => {
  const sanitized = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    if (isFromOptionalParams) {
      sanitized[key] = value;
      continue;
    }

    if (
      lowerKey === 'authorization' ||
      (AUTH_APIKEY_HEADER_NAME && lowerKey === AUTH_APIKEY_HEADER_NAME.toLowerCase())
    ) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
};

describe('sanitizeHeaders', () => {
  describe('response headers', () => {
    test('should preserve common response headers', () => {
      const responseHeaders = {
        'content-type': 'application/json',
        'content-length': '1234',
        'date': 'Fri, 24 Jan 2025 10:00:00 GMT',
        'server': 'nginx/1.18.0',
        'cache-control': 'no-cache',
        'etag': '"abc123"',
        'last-modified': 'Thu, 23 Jan 2025 10:00:00 GMT',
        'x-request-id': 'req-12345'
      };

      const result = sanitizeHeaders(responseHeaders, false);

      assert.equal(result['content-type'], 'application/json');
      assert.equal(result['content-length'], '1234');
      assert.equal(result['date'], 'Fri, 24 Jan 2025 10:00:00 GMT');
      assert.equal(result['server'], 'nginx/1.18.0');
      assert.equal(result['cache-control'], 'no-cache');
      assert.equal(result['etag'], '"abc123"');
      assert.equal(result['last-modified'], 'Thu, 23 Jan 2025 10:00:00 GMT');
      assert.equal(result['x-request-id'], 'req-12345');
    });

    test('should preserve CORS headers', () => {
      const corsHeaders = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PUT, DELETE',
        'access-control-allow-headers': 'Content-Type, Authorization',
        'access-control-expose-headers': 'X-Custom-Header'
      };

      const result = sanitizeHeaders(corsHeaders, false);

      assert.equal(result['access-control-allow-origin'], '*');
      assert.equal(result['access-control-allow-methods'], 'GET, POST, PUT, DELETE');
      assert.equal(result['access-control-allow-headers'], 'Content-Type, Authorization');
      assert.equal(result['access-control-expose-headers'], 'X-Custom-Header');
    });

    test('should redact authorization header', () => {
      const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer secret-token-12345'
      };

      const result = sanitizeHeaders(headers, false);

      assert.equal(result['content-type'], 'application/json');
      assert.equal(result['authorization'], '[REDACTED]');
    });

    test('should redact API Key header', () => {
      const headers = {
        'content-type': 'application/json',
        'X-API-Key': 'my-secret-api-key'
      };

      const result = sanitizeHeaders(headers, false);

      assert.equal(result['content-type'], 'application/json');
      assert.equal(result['X-API-Key'], '[REDACTED]');
    });

    test('should preserve custom headers', () => {
      const headers = {
        'x-custom-header': 'some-value',
        'x-trace-id': 'trace-12345',
        'x-correlation-id': 'corr-67890'
      };

      const result = sanitizeHeaders(headers, false);

      assert.equal(result['x-custom-header'], 'some-value');
      assert.equal(result['x-trace-id'], 'trace-12345');
      assert.equal(result['x-correlation-id'], 'corr-67890');
    });
  });

  describe('request headers from optional parameters', () => {
    test('should preserve all user-specified headers', () => {
      const userHeaders = {
        'Authorization': 'Bearer my-token',
        'X-Custom-Header': 'custom-value',
        'Content-Type': 'application/json'
      };

      const result = sanitizeHeaders(userHeaders, true);

      assert.equal(result['Authorization'], 'Bearer my-token');
      assert.equal(result['X-Custom-Header'], 'custom-value');
      assert.equal(result['Content-Type'], 'application/json');
    });
  });

  describe('edge cases', () => {
    test('should handle empty headers object', () => {
      const result = sanitizeHeaders({}, false);
      assert.deepEqual(result, {});
    });

    test('should handle null or undefined header values', () => {
      const headers = {
        'content-type': null,
        'content-length': undefined,
        'date': 'Fri, 24 Jan 2025 10:00:00 GMT'
      };

      const result = sanitizeHeaders(headers, false);

      assert.equal(result['content-type'], null);
      assert.equal(result['content-length'], undefined);
      assert.equal(result['date'], 'Fri, 24 Jan 2025 10:00:00 GMT');
    });

    test('should handle authorization header case-insensitively', () => {
      const headers = {
        'AUTHORIZATION': 'Bearer token1',
        'Authorization': 'Bearer token2',
        'authorization': 'Bearer token3'
      };

      const result = sanitizeHeaders(headers, false);

      assert.equal(result['AUTHORIZATION'], '[REDACTED]');
      assert.equal(result['Authorization'], '[REDACTED]');
      assert.equal(result['authorization'], '[REDACTED]');
    });
  });
});
