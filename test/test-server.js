#!/usr/bin/env node

// Simple file upload test server
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ dest: 'test/uploads/' });

// Parse JSON body
app.use(express.json());

// Test endpoint 1: Single file upload
app.post('/upload/single', upload.single('avatar'), (req, res) => {
  console.log('📁 Received single file upload request:');
  console.log('  File:', req.file);
  console.log('  Form fields:', req.body);

  res.json({
    success: true,
    message: 'File uploaded successfully',
    file: req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      savedAs: req.file.filename
    } : null,
    formFields: req.body
  });
});

// Test endpoint 2: Multiple file upload
app.post('/upload/multiple', upload.array('files', 10), (req, res) => {
  console.log('📁 Received multiple file upload request:');
  console.log('  File count:', req.files?.length || 0);
  console.log('  Form fields:', req.body);

  res.json({
    success: true,
    message: `Successfully uploaded ${req.files?.length || 0} file(s)`,
    files: req.files?.map(f => ({
      fieldname: f.fieldname,
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size
    })) || [],
    formFields: req.body
  });
});

// Test endpoint 3: Mixed field upload
app.post('/upload/mixed', upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'attachments', maxCount: 5 }
]), (req, res) => {
  console.log('📁 Received mixed file upload request:');
  console.log('  Files:', req.files);
  console.log('  Form fields:', req.body);

  res.json({
    success: true,
    message: 'Mixed upload successful',
    files: req.files,
    formFields: req.body
  });
});

// Test endpoint 4: Pure JSON (no files)
app.post('/api/data', (req, res) => {
  console.log('📝 Received pure JSON request:', req.body);

  res.json({
    success: true,
    message: 'JSON data received successfully',
    receivedData: req.body
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Test server is running' });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  🚀 File Upload Test Server Started                        ║
╠════════════════════════════════════════════════════════════╣
║  Address: http://localhost:${PORT}                         ║
║                                                            ║
║  Test Endpoints:                                           ║
║  • POST /upload/single     - Single file (field: avatar)   ║
║  • POST /upload/multiple   - Multiple files (field: files) ║
║  • POST /upload/mixed      - Mixed upload                  ║
║  • POST /api/data          - Pure JSON test                ║
║  • GET  /health            - Health check                  ║
║                                                            ║
║  Uploaded files saved to ./test/uploads/                   ║
╚════════════════════════════════════════════════════════════╝
  `);
});
