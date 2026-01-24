import { test, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import { checkFileSize, checkFileExists } from '../build/file-utils.js';

// Test fixtures path
const fixturesDir = path.join(process.cwd(), 'test', 'fixtures', 'file-size');
const smallFile = path.join(fixturesDir, 'small.txt');
const largeFile = path.join(fixturesDir, 'large.txt');
const nonExistentFile = path.join(fixturesDir, 'non-existent.txt');

before(async () => {
  // Create fixtures directory
  await fs.mkdir(fixturesDir, { recursive: true });

  // Create small file (100 bytes)
  await fs.writeFile(smallFile, 'a'.repeat(100));

  // Create large file (2MB)
  await fs.writeFile(largeFile, 'b'.repeat(2 * 1024 * 1024));
});

after(async () => {
  // Clean up test files
  await fs.rm(fixturesDir, { recursive: true, force: true });
});

test('should pass files smaller than limit', async () => {
  await assert.doesNotReject(
    checkFileSize(smallFile, 1024) // 1KB limit
  );
});

test('should reject files exceeding size limit', async () => {
  await assert.rejects(
    checkFileSize(largeFile, 1024 * 1024), // 1MB limit
    /exceeds size limit/
  );
});

test('should reject non-existent files', async () => {
  await assert.rejects(
    checkFileExists(nonExistentFile),
    /does not exist/
  );
});

test('should accept existing files', async () => {
  await assert.doesNotReject(
    checkFileExists(smallFile)
  );
});
