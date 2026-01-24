import { test, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateFiles } from '../build/file-utils.js';

const fixturesDir = path.join(process.cwd(), 'test', 'fixtures', 'error-handling');
const validFile = path.join(fixturesDir, 'valid.txt');
const largeFile = path.join(fixturesDir, 'too-large.txt');

before(async () => {
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.writeFile(validFile, 'Valid content');
  // Create a file larger than 10MB
  await fs.writeFile(largeFile, 'x'.repeat(11 * 1024 * 1024));
});

after(async () => {
  await fs.rm(fixturesDir, { recursive: true, force: true });
});

test('should reject path traversal attacks', async () => {
  const files = [
    { fieldName: 'file', filePath: '../../../etc/passwd' }
  ];

  await assert.rejects(
    validateFiles(files, 10 * 1024 * 1024),
    /Path traversal/,
    'Should detect path traversal attack'
  );
});

test('should reject non-existent files', async () => {
  const files = [
    { fieldName: 'file', filePath: path.join(fixturesDir, 'non-existent.txt') }
  ];

  await assert.rejects(
    validateFiles(files, 10 * 1024 * 1024),
    /does not exist/,
    'Should detect that file does not exist'
  );
});

test('should reject files exceeding size limit', async () => {
  const files = [
    { fieldName: 'file', filePath: largeFile }
  ];

  await assert.rejects(
    validateFiles(files, 10 * 1024 * 1024), // 10MB limit
    /exceeds size limit/,
    'Should detect file exceeding size limit'
  );
});

test('should reject list with mixed valid and invalid files', async () => {
  const files = [
    { fieldName: 'valid', filePath: validFile },
    { fieldName: 'invalid', filePath: '../etc/hosts' }
  ];

  await assert.rejects(
    validateFiles(files, 10 * 1024 * 1024),
    /Path traversal/,
    'Should detect invalid file during validation'
  );
});

test('should accept all valid files', async () => {
  const files = [
    { fieldName: 'file1', filePath: validFile },
    { fieldName: 'file2', filePath: validFile }
  ];

  await assert.doesNotReject(
    validateFiles(files, 10 * 1024 * 1024),
    'All valid files should pass validation'
  );
});

test('should accept empty fieldName', async () => {
  const files = [
    { fieldName: '', filePath: validFile }
  ];

  // Empty fieldName passes file validation but is a logical error
  // Current implementation does not validate fieldName
  // This test documents this edge case
  await assert.doesNotReject(
    validateFiles(files, 10 * 1024 * 1024)
  );
});
