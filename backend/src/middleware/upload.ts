import multer from 'multer';
import path from 'path';
import fs from 'fs';

const backendRoot = path.resolve(__dirname, '..', '..');
const uploadDir = path.join(backendRoot, 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Created upload directory: ${uploadDir}`);
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use original filename + timestamp to avoid collisions
    cb(null, Date.now() + '-' + file.originalname);
  }
});

export const upload = multer({ storage: storage }); 