import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getJobById, removeJobFromCompleted } from '../services/queueService';

const router = express.Router();

router.get('/:jobId', (req: Request, res: Response) => {
  const jobId = req.params.jobId;
  // Find the job in memory
  const job = getJobById(jobId);
  
  if (!job) {
    return res.status(404).send('Job not found or server restarted.');
  }

  if (job.status !== 'complete' || !job.mp3Path) {
    return res.status(400).send('Job is not complete or output file is missing.');
  }

  // Check if the file actually exists on disk
  if (!fs.existsSync(job.mp3Path)) {
    console.error(`[Download]: File not found on disk for job ${jobId}: ${job.mp3Path}`);
    job.status = 'error';
    job.error = 'Output file missing from server.';
    return res.status(500).send('Output file not found on server.');
  }

  console.log(`[Download]: Sending file for job ${jobId}: ${job.mp3Path}`);
  // Use res.download to trigger browser download with the correct filename
  const downloadFilename = path.basename(job.mp3Path); 
  res.download(job.mp3Path, downloadFilename, (err) => {
    if (err) {
      console.error(`[Download]: Error sending file for job ${jobId}:`, err);
      if (!res.headersSent) {
        res.status(500).send('Error occurred during file download.');
      }
    } else {
      console.log(`[Download]: Successfully sent file for job ${jobId}`);
      // Remove the job from completedJobs after successful download
      removeJobFromCompleted(jobId);
      // Optionally, delete the output file after download
      if (job.mp3Path && fs.existsSync(job.mp3Path)) {
        fs.unlink(job.mp3Path, (err) => {
          if (err) console.error(`[Cleanup]: Failed to delete file ${job.mp3Path}:`, err);
          else console.log(`[Cleanup]: Deleted file ${job.mp3Path} for downloaded job ${jobId}`);
        });
      }
    }
  });
});

export default router; 