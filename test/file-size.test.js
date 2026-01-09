import { test, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import { checkFileSize, checkFileExists } from '../build/file-utils.js';

// 测试fixtures路径
const fixturesDir = path.join(process.cwd(), 'test', 'fixtures', 'file-size');
const smallFile = path.join(fixturesDir, 'small.txt');
const largeFile = path.join(fixturesDir, 'large.txt');
const nonExistentFile = path.join(fixturesDir, 'non-existent.txt');

before(async () => {
  // 创建fixtures目录
  await fs.mkdir(fixturesDir, { recursive: true });

  // 创建小文件 (100 bytes)
  await fs.writeFile(smallFile, 'a'.repeat(100));

  // 创建大文件 (2MB)
  await fs.writeFile(largeFile, 'b'.repeat(2 * 1024 * 1024));
});

after(async () => {
  // 清理测试文件
  await fs.rm(fixturesDir, { recursive: true, force: true });
});

test('应该通过小于限制的文件', async () => {
  await assert.doesNotReject(
    checkFileSize(smallFile, 1024) // 1KB限制
  );
});

test('应该拒绝超过大小限制的文件', async () => {
  await assert.rejects(
    checkFileSize(largeFile, 1024 * 1024), // 1MB限制
    /exceeds size limit/
  );
});

test('应该拒绝不存在的文件', async () => {
  await assert.rejects(
    checkFileExists(nonExistentFile),
    /does not exist/
  );
});

test('应该接受存在的文件', async () => {
  await assert.doesNotReject(
    checkFileExists(smallFile)
  );
});
