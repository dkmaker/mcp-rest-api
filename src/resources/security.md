# Security Configuration and Best Practices

This document outlines security features, configurations, and best practices for the MCP REST API server.

## Security Features

### Input Validation and Sanitization
- **URL Length Limits**: URLs are limited to 2048 characters to prevent DoS attacks
- **Header Validation**: Custom headers are validated for length and character set
- **Input Sanitization**: All input strings are sanitized to remove control characters and null bytes
- **Parameter Limits**: Maximum of 50 custom headers per request

### Rate Limiting and DoS Protection
- **Concurrent Request Limiting**: Maximum 10 concurrent requests by default
- **Rate Limiting**: Maximum 100 requests per minute by default
- **Request Timeout**: 30 second timeout for all requests
- **Response Size Limiting**: Configurable response size limits (default 10KB, max 50MB)

### Authentication Security
- **Credential Redaction**: Sensitive headers are automatically redacted in logs
- **Multiple Auth Methods**: Support for Basic Auth, Bearer tokens, and API keys
- **Environment-based Configuration**: Credentials stored in environment variables only

### Information Security
- **Error Message Sanitization**: Detailed error messages only in development mode
- **Security Logging**: Optional security event logging
- **Header Sanitization**: Sensitive headers are redacted in all outputs
- **SSRF Protection**: Private network access restrictions in production

## Security Configuration

### Environment Variables

#### Core Security Settings
```bash
# Disable SSL verification (development only)
REST_ENABLE_SSL_VERIFY=false

# Enable detailed error messages (development only)
NODE_ENV=development

# Enable security logging
ENABLE_SECURITY_LOGGING=true

# Disable security headers (not recommended)
DISABLE_SECURITY_HEADERS=true

# Allow private network access (development only)
ALLOW_PRIVATE_NETWORKS=true
```

#### Rate Limiting Configuration
```bash
# Override default rate limiting (use with caution)
MAX_CONCURRENT_REQUESTS=10
MAX_REQUESTS_PER_WINDOW=100
RATE_LIMIT_WINDOW=60000  # milliseconds
```

#### Response Size Limits
```bash
# Maximum response size (default: 10000 bytes)
REST_RESPONSE_SIZE_LIMIT=50000

# Note: Cannot exceed 52428800 bytes (50MB) for security reasons
```

### Security Headers

The server automatically includes security-conscious header handling:

- **Sensitive Headers**: Authorization, cookies, API keys are automatically redacted
- **Safe Headers**: Content-Type, Accept, User-Agent values are preserved in logs
- **Custom Headers**: Environment-defined headers are validated and sanitized

### Network Security

#### SSRF Protection
- Private network access (localhost, 127.0.0.1, 10.x.x.x, 192.168.x.x, 172.x.x.x) is blocked in production
- Full URLs are validated for protocol (http/https only)
- Host parameter validation prevents malicious redirects

#### SSL/TLS Configuration
- SSL verification is enabled by default
- Can be disabled for development with `REST_ENABLE_SSL_VERIFY=false`
- Keep-alive connections are used for performance

## Security Best Practices

### Development vs Production

#### Development Environment
```bash
NODE_ENV=development
REST_ENABLE_SSL_VERIFY=false
ALLOW_PRIVATE_NETWORKS=true
ENABLE_SECURITY_LOGGING=true
```

#### Production Environment
```bash
NODE_ENV=production
REST_ENABLE_SSL_VERIFY=true
ALLOW_PRIVATE_NETWORKS=false
ENABLE_SECURITY_LOGGING=true
DISABLE_SECURITY_HEADERS=false
```

### Authentication Best Practices

1. **Use Environment Variables**: Never hardcode credentials
2. **Rotate Credentials**: Regularly rotate API keys and tokens
3. **Principle of Least Privilege**: Use minimal required permissions
4. **Monitor Usage**: Enable security logging in production

### Network Security

1. **Use HTTPS**: Always use HTTPS in production
2. **Firewall Rules**: Restrict outbound network access if possible
3. **Rate Limiting**: Monitor and adjust rate limits based on usage
4. **SSL Verification**: Keep SSL verification enabled in production

### Monitoring and Logging

1. **Security Logging**: Enable security logging for audit trails
2. **Error Monitoring**: Monitor for unusual error patterns
3. **Rate Limit Monitoring**: Track rate limit hits and patterns
4. **Performance Monitoring**: Monitor request timing and response sizes

## Security Considerations

### Known Limitations

1. **MCP Protocol**: The server runs over stdio, limiting some security controls
2. **Client Trust**: The server trusts the MCP client for request validation
3. **Environment Variables**: Sensitive data in environment variables may be visible to processes

### Risk Mitigation

1. **Principle of Least Privilege**: Run with minimal required permissions
2. **Network Isolation**: Deploy in isolated network environments when possible
3. **Regular Updates**: Keep dependencies updated for security patches
4. **Monitoring**: Implement comprehensive logging and monitoring

## Docker Security

### Dockerfile Security Issues

The current Dockerfile has several security warnings:

1. **Secret Exposure**: Authentication environment variables should not be defined in Dockerfile
2. **Build Context**: Sensitive files should be excluded with .dockerignore
3. **User Permissions**: Container should run as non-root user

### Recommended Docker Security

```dockerfile
# Use non-root user
USER node

# Don't define secrets in Dockerfile
# Use docker secrets or environment files instead

# Exclude sensitive files in .dockerignore
.env
.env.local
*.log
node_modules
```

## Compliance and Standards

This implementation follows security best practices from:

- OWASP Top 10 Web Application Security Risks
- Node.js Security Best Practices
- REST API Security Guidelines
- Docker Security Best Practices

For additional security requirements, consider implementing:
- Request signing/verification
- API key rotation mechanisms
- Advanced rate limiting strategies
- Request/response encryption
- Audit logging compliance