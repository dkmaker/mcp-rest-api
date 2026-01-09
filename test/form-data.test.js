import { test, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateFiles, createFormData } from '../build/file-utils.js';

const fixturesDir = path.join(process.cwd(), 'test', 'fixtures', 'form-data');
const file1 = path.join(fixturesDir, 'file1.txt');
const file2 = path.join(fixturesDir, 'file2.txt');
const imageFile = path.join(fixturesDir, 'test.png');

before(async () => {
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.writeFile(file1, 'File 1 content');
  await fs.writeFile(file2, 'File 2 content');
  // 创建一个小的PNG文件（1x1像素）
  const pngBuffer = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000000500010d0a2db40000000049454e44ae426082',
    'hex'
  );
  await fs.writeFile(imageFile, pngBuffer);
});

after(async () => {
  await fs.rm(fixturesDir, { recursive: true, force: true });
});

test('validateFiles应该验证所有文件', async () => {
  const files = [
    { fieldName: 'file1', filePath: file1 },
    { fieldName: 'file2', filePath: file2 }
  ];

  await assert.doesNotReject(
    validateFiles(files, 1024 * 1024) // 1MB限制
  );
});

test('validateFiles应该拒绝包含无效文件的列表', async () => {
  const files = [
    { fieldName: 'file1', filePath: file1 },
    { fieldName: 'bad', filePath: '../etc/passwd' }
  ];

  await assert.rejects(
    validateFiles(files, 1024 * 1024),
    /Path traversal/
  );
});

test('createFormData应该创建包含单个文件的FormData', async () => {
  const files = [
    { fieldName: 'avatar', filePath: file1 }
  ];

  const formData = await createFormData(files);

  assert(formData);
  assert.strictEqual(typeof formData.append, 'function');
});

test('createFormData应该支持多个文件', async () => {
  const files = [
    { fieldName: 'file1', filePath: file1 },
    { fieldName: 'file2', filePath: file2 }
  ];

  const formData = await createFormData(files);

  assert(formData);
});

test('createFormData应该支持自定义文件名和contentType', async () => {
  const files = [
    {
      fieldName: 'image',
      filePath: imageFile,
      fileName: 'custom-name.png',
      contentType: 'image/png'
    }
  ];

  const formData = await createFormData(files);

  assert(formData);
});

test('createFormData应该添加formFields', async () => {
  const files = [
    { fieldName: 'avatar', filePath: file1 }
  ];
  const formFields = {
    title: 'My Upload',
    description: 'Test upload'
  };

  const formData = await createFormData(files, formFields);

  assert(formData);
});

test('createFormData应该添加body字段', async () => {
  const files = [
    { fieldName: 'file', filePath: file1 }
  ];
  const body = {
    userId: 123,
    tags: ['test', 'upload']
  };

  const formData = await createFormData(files, undefined, body);

  assert(formData);
});
