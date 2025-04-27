import path from 'path';
import fs from 'fs';

const backendRoot = path.resolve(__dirname, '..', '..');
const uploadDir = path.join(backendRoot, 'uploads');
const outputDir = path.join(backendRoot, 'outputs');

// Ensure directories exist
export const setupDirectories = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Created upload directory: ${uploadDir}`);
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  }
}; 