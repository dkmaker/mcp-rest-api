## [0.5.0](https://github.com/qwang07/mcp-rest-api/compare/v0.4.0...v0.5.0) (2025-10-23)

### Features

* **file-upload**: add comprehensive file upload support with multipart/form-data ([2ae2535](https://github.com/qwang07/mcp-rest-api/commit/2ae2535))
  - Upload single or multiple files via local file paths
  - Support file + form fields + JSON body mixing
  - Configurable file size limits via FILE_UPLOAD_SIZE_LIMIT (default: 10MB)
  - Path traversal attack protection
  - Modular file-utils.ts with validation and FormData creation
  - 23 unit tests with TDD approach
  - Complete documentation and examples

### Documentation

* Updated README.md with file upload features and examples
* Added FILE_UPLOAD_SIZE_LIMIT configuration to config.md
* Added comprehensive file upload examples to examples.md

### Tests

* Added 23 unit tests for file upload functionality
* Test server for integration testing
* End-to-end test suite

## [0.4.0](https://github.com/dkmaker/mcp-rest-api/compare/v0.3.0...v0.4.0) (2025-01-08)


### Features

* add custom header support ([9a48e0d](https://github.com/dkmaker/mcp-rest-api/commit/9a48e0d794a743f7a62c7cb73d6f5b1be9e44107))

## [0.3.0](https://github.com/dkmaker/mcp-rest-api/compare/v0.2.0...v0.3.0) (2024-12-28)


### Features

* add config documentation and improve URL resolution examples ([8c6100f](https://github.com/dkmaker/mcp-rest-api/commit/8c6100f47777605a0571edbd161ffd20fc48b640))
* add MCP resources for documentation ([a20cf35](https://github.com/dkmaker/mcp-rest-api/commit/a20cf352e9731841a8d7e833007a96bdd1a0c390))


### Bug Fixes

* correct response truncation to return first N bytes ([ce34649](https://github.com/dkmaker/mcp-rest-api/commit/ce34649c4d8e6bc6d740e8f3fbc6e3df517e0eec))

## [0.2.0](https://github.com/dkmaker/mcp-rest-api/compare/0fdbe844dd4ce8b79f38a33df323a29e28253724...v0.2.0) (2024-12-21)


### Features

* **ssl:** add SSL verification control with secure defaults ([0fdbe84](https://github.com/dkmaker/mcp-rest-api/commit/0fdbe844dd4ce8b79f38a33df323a29e28253724))

