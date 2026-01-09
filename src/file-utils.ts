import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import FormData from 'form-data';

export interface FileUpload {
  fieldName: string;
  filePath: string;
  fileName?: string;
  contentType?: string;
}

// (filePath: string) => void
export const validateFilePath = (filePath: string): void => {
  if (filePath.includes('..')) {
    throw new Error('Path traversal attack detected');
  }
};

// (filePath: string) => Promise<void>
export const checkFileExists = async (filePath: string): Promise<void> => {
  try {
    await fs.access(filePath, fs.constants.R_OK);
  } catch (error) {
    throw new Error(`File does not exist or is not readable: ${filePath}`);
  }
};

// (filePath: string, sizeLimit: number) => Promise<void>
export const checkFileSize = async (filePath: string, sizeLimit: number): Promise<void> => {
  const stats = await fs.stat(filePath);
  if (stats.size > sizeLimit) {
    throw new Error(`File exceeds size limit: ${stats.size} bytes > ${sizeLimit} bytes`);
  }
};

// (files: FileUpload[], sizeLimit: number) => Promise<void>
export const validateFiles = async (files: FileUpload[], sizeLimit: number): Promise<void> => {
  for (const file of files) {
    validateFilePath(file.filePath);
    await checkFileExists(file.filePath);
    await checkFileSize(file.filePath, sizeLimit);
  }
};

// (files: FileUpload[], formFields?: Record<string, string>, body?: any) => Promise<FormData>
export const createFormData = async (
  files: FileUpload[],
  formFields?: Record<string, string>,
  body?: any
): Promise<FormData> => {
  const formData = new FormData();

  // Add files
  for (const file of files) {
    const fileStream = fsSync.createReadStream(file.filePath);
    const fileName = file.fileName || path.basename(file.filePath);
    const options: any = { filename: fileName };

    if (file.contentType) {
      options.contentType = file.contentType;
    }

    formData.append(file.fieldName, fileStream, options);
  }

  // Add form fields
  if (formFields) {
    for (const [key, value] of Object.entries(formFields)) {
      formData.append(key, value);
    }
  }

  // Add body fields (convert to JSON string)
  if (body) {
    for (const [key, value] of Object.entries(body)) {
      formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  return formData;
};
