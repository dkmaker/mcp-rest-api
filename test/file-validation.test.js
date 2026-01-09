import { test } from 'node:test';
import assert from 'node:assert';
import { validateFilePath } from '../build/file-utils.js';

test('应该拒绝包含..的路径', () => {
  assert.throws(
    () => validateFilePath('../etc/passwd'),
    /Path traversal/
  );
});

test('应该拒绝包含多个..的路径', () => {
  assert.throws(
    () => validateFilePath('../../etc/passwd'),
    /Path traversal/
  );
});

test('应该拒绝隐藏在路径中间的..', () => {
  assert.throws(
    () => validateFilePath('/tmp/../etc/passwd'),
    /Path traversal/
  );
});

test('应该接受正常的相对路径', () => {
  assert.doesNotThrow(() => validateFilePath('./test.txt'));
});

test('应该接受正常的绝对路径', () => {
  assert.doesNotThrow(() => validateFilePath('/tmp/test.txt'));
});

test('应该接受包含点号但不是..的路径', () => {
  assert.doesNotThrow(() => validateFilePath('./file.test.txt'));
});
