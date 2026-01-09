# REST API Testing Examples

⚠️ IMPORTANT:
- Only provide the endpoint path in the `endpoint` argument—do not include full URLs. Your path will be automatically resolved to the full URL using the configured base URL or the optional `host` argument.
- To override the base URL for a single request, use the optional `host` argument. This must be a valid URL starting with `http://` or `https://`, and may include a path (trailing slashes will be removed).

For example, if the base URL is `http://localhost:3000`:
✅ Correct: `"/api/users"` → Resolves to: `http://localhost:3000/api/users`
❌ Incorrect: `"http://localhost:3000/api/users"` or `"www.example.com/api/users"`

If you use a `host` argument:
✅ Correct: `"host": "https://api.example.com/v1", "endpoint": "/users"` → Resolves to: `https://api.example.com/v1/users`

## Basic GET Request
```typescript
use_mcp_tool('rest-api', 'test_request', {
  "method": "GET",
  "endpoint": "/users"  // Will be appended to REST_BASE_URL or 'host' if provided
});
```

## GET with Query Parameters
```typescript
use_mcp_tool('rest-api', 'test_request', {
  "method": "GET",
  "endpoint": "/users?role=admin&status=active" // Always a path, not a full URL
});
```

## POST Request with Body
```typescript
use_mcp_tool('rest-api', 'test_request', {
  "method": "POST",
  "endpoint": "/users",
  "body": {
    "name": "John Doe",
    "email": "john@example.com"
  }
});
```

## Request with Custom Headers
```typescript
use_mcp_tool('rest-api', 'test_request', {
  "method": "GET",
  "endpoint": "/secure-resource",
  "headers": {
    "Custom-Header": "value",
    "Another-Header": "another-value"
  }
});
```

## PUT Request Example
```typescript
use_mcp_tool('rest-api', 'test_request', {
  "method": "PUT",
  "endpoint": "/users/123",
  "body": {
    "name": "Updated Name",
    "status": "inactive"
  }
});
```

## DELETE Request Example
```typescript
use_mcp_tool('rest-api', 'test_request', {
  "method": "DELETE",
  "endpoint": "/users/123"
});
```

## PATCH Request Example
```typescript
use_mcp_tool('rest-api', 'test_request', {
  "method": "PATCH",
  "endpoint": "/users/123",
  "body": {
    "status": "active"
  }
});
```

## Using the Optional `host` Argument
You can override the default base URL for a single request by providing a `host` argument. This must be a valid URL starting with `http://` or `https://`, and may include a path (trailing slashes will be removed).

```typescript
use_mcp_tool('rest-api', 'test_request', {
  "method": "GET",
  "endpoint": "/users",
  "host": "https://api.example.com/v1" // The request will go to https://api.example.com/v1/users
});
```

- The `host` argument must include the protocol (http or https).
- If a path is included, any trailing slash will be removed.
- If `host` is invalid, you will receive a clear error message.
- The `endpoint` argument must always be a path, never a full URL.

## Changing Base URL
If you need to test against a different base URL for all requests, update the base URL configuration rather than including the full URL in the endpoint parameter. For a single request, use the `host` argument as shown above.

Example:
```bash
# Instead of this:
❌ "endpoint": "https://api.example.com/users"  # Wrong - don't include the full URL

# Do this:
# 1. Update the base URL configuration to: https://api.example.com
# 2. Then use just the path:
✅ "endpoint": "/users"  # This will resolve to: https://api.example.com/users
# Or, for a single request:
✅ "host": "https://api.example.com", "endpoint": "/users"  # This will resolve to: https://api.example.com/users
```

## File Upload Examples

### Single File Upload
Upload a single file to an API endpoint:

```typescript
use_mcp_tool('rest-api', 'test_request', {
  "method": "POST",
  "endpoint": "/upload",
  "files": [
    {
      "fieldName": "avatar",           // Form field name
      "filePath": "./profile-pic.jpg"  // Local file path
    }
  ]
});
```

### Multiple Files Upload
Upload multiple files in a single request:

```typescript
use_mcp_tool('rest-api', 'test_request', {
  "method": "POST",
  "endpoint": "/upload/multiple",
  "files": [
    {
      "fieldName": "file1",
      "filePath": "./document1.pdf"
    },
    {
      "fieldName": "file2",
      "filePath": "./document2.pdf"
    },
    {
      "fieldName": "image",
      "filePath": "./photo.png",
      "fileName": "custom-name.png",    // Optional: override filename
      "contentType": "image/png"        // Optional: set MIME type
    }
  ]
});
```

### File Upload with Form Fields
Combine file uploads with additional form data:

```typescript
use_mcp_tool('rest-api', 'test_request', {
  "method": "POST",
  "endpoint": "/posts",
  "files": [
    {
      "fieldName": "thumbnail",
      "filePath": "./thumbnail.jpg"
    }
  ],
  "formFields": {
    "title": "My Blog Post",
    "description": "A great article",
    "category": "technology"
  }
});
```

### File Upload with JSON Body
You can also include a body parameter alongside files. The body fields will be added to the form data:

```typescript
use_mcp_tool('rest-api', 'test_request', {
  "method": "POST",
  "endpoint": "/upload/with-metadata",
  "files": [
    {
      "fieldName": "attachment",
      "filePath": "./report.pdf"
    }
  ],
  "body": {
    "uploadedBy": "user123",
    "timestamp": "2025-01-15T10:30:00Z",
    "tags": ["report", "q1"]
  }
});
```

### File Upload Constraints
- **Maximum file size**: Default is 10MB per file (configurable via `FILE_UPLOAD_SIZE_LIMIT` environment variable)
- **Path security**: File paths containing `..` (path traversal) are rejected for security
- **Supported paths**: Both relative (e.g., `./file.txt`) and absolute (e.g., `/tmp/file.txt`) paths are supported
- **File validation**: Files are validated for existence and size before upload
- **Encoding**: When files are present, the request automatically uses `multipart/form-data` encoding
