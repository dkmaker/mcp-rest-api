import { test } from 'node:test';
import assert from 'node:assert';
import { validateFilePath } from '../build/file-utils.js';

test('should reject paths containing ..', () => {
  assert.throws(
    () => validateFilePath('../etc/passwd'),
    /Path traversal/
  );
});

test('should reject paths with multiple ..', () => {
  assert.throws(
    () => validateFilePath('../../etc/passwd'),
    /Path traversal/
  );
});

test('should reject .. hidden in middle of path', () => {
  assert.throws(
    () => validateFilePath('/tmp/../etc/passwd'),
    /Path traversal/
  );
});

test('should accept normal relative paths', () => {
  assert.doesNotThrow(() => validateFilePath('./test.txt'));
});

test('should accept normal absolute paths', () => {
  assert.doesNotThrow(() => validateFilePath('/tmp/test.txt'));
});

test('should accept paths with dots that are not ..', () => {
  assert.doesNotThrow(() => validateFilePath('./file.test.txt'));
});
