import express, { Request, Response } from 'express';
import { upload } from '../middleware/upload';
import { v4 as uuidv4 } from 'uuid';
import { ConversionJob, broadcastQueueStatus, addJobToQueue } from '../services/queueService';
import { ConversionOptions } from '../converter';

const router = express.Router();

router.post('/', upload.single('video'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const jobId = uuidv4();
  const job: ConversionJob = {
    id: jobId,
    originalPath: req.file.path,
    originalFilename: req.file.originalname,
    options: {},
    status: 'uploading',
    uploadProgress: 0,
    conversionProgress: 0
  };

  // Simulate upload progress for demonstration; in a real scenario, this would be based on actual upload progress
  let uploadProgress = 0;
  const uploadInterval = setInterval(() => {
    uploadProgress += 10;
    if (uploadProgress > 100) uploadProgress = 100;
    job.uploadProgress = uploadProgress;
    broadcastQueueStatus();
    if (uploadProgress >= 100) {
      clearInterval(uploadInterval);
      job.status = 'uploaded';
      broadcastQueueStatus();
      // Parse trimming options if provided
      if (req.body.startTime) {
        job.options.startTime = parseFloat(req.body.startTime);
      }
      if (req.body.endTime) {
        job.options.endTime = parseFloat(req.body.endTime);
      }
      addJobToQueue(job);
      broadcastQueueStatus();
    }
  }, 500);

  res.status(202).json({ jobId });
});

export default router; 