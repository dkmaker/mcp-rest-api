#!/usr/bin/env node

// End-to-end test: Interact with MCP server via stdio
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Start MCP server
const mcp = spawn('node', ['build/index.js'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    REST_BASE_URL: 'http://localhost:3000',
    FILE_UPLOAD_SIZE_LIMIT: '10485760' // 10MB
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';
let testsPassed = 0;
let testsFailed = 0;

// (message: object) => void
const sendMessage = (message) => {
  const json = JSON.stringify(message);
  console.log(`\n→ Sending: ${json.substring(0, 100)}...`);
  mcp.stdin.write(json + '\n');
};

// (data: string) => void
const handleResponse = (data) => {
  buffer += data;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (line.trim()) {
      console.log(`← Received: ${line.substring(0, 100)}...`);
      try {
        const response = JSON.parse(line);
        if (response.error) {
          console.error('❌ Error:', response.error);
          testsFailed++;
        } else if (response.result) {
          console.log('✅ Success:', response.result.content?.[0]?.text || JSON.stringify(response.result).substring(0, 100));
          testsPassed++;
        }
      } catch (e) {
        // Ignore non-JSON lines
      }
    }
  }
};

mcp.stdout.on('data', handleResponse);
mcp.stderr.on('data', (data) => {
  console.error('MCP stderr:', data.toString());
});

mcp.on('close', (code) => {
  console.log(`\n\n📊 Test Complete:`);
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   Exit code: ${code}`);
  process.exit(testsFailed > 0 ? 1 : 0);
});

// Wait for MCP server initialization
setTimeout(() => {
  console.log('🚀 Starting end-to-end tests...\n');

  // Test 1: Get tool list
  sendMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  });

  setTimeout(() => {
    // Test 2: Single file upload
    sendMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'test_request',
        arguments: {
          method: 'POST',
          endpoint: '/upload/single',
          files: [{
            fieldName: 'avatar',
            filePath: join(projectRoot, 'test/test-file.txt')
          }],
          formFields: {
            username: 'e2e-test-user'
          }
        }
      }
    });
  }, 1000);

  setTimeout(() => {
    // Test 3: Multiple file upload
    sendMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'test_request',
        arguments: {
          method: 'POST',
          endpoint: '/upload/multiple',
          files: [
            {
              fieldName: 'files',
              filePath: join(projectRoot, 'test/test-file.txt')
            },
            {
              fieldName: 'files',
              filePath: join(projectRoot, 'test/test-file-2.txt')
            }
          ]
        }
      }
    });
  }, 2000);

  setTimeout(() => {
    // Test 4: Path traversal attack detection
    sendMessage({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'test_request',
        arguments: {
          method: 'POST',
          endpoint: '/upload/single',
          files: [{
            fieldName: 'avatar',
            filePath: '../../../etc/passwd'
          }]
        }
      }
    });
  }, 3000);

  // Close server
  setTimeout(() => {
    console.log('\n🛑 Closing MCP server...');
    mcp.kill();
  }, 4000);

}, 500);
