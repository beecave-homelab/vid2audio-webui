import { WebSocket } from 'ws';
import { convertVideoToMp3, ConversionOptions } from '../converter';
import fs from 'fs';
import path from 'path';
import { broadcast } from './webSocketService';

// Conversion Job Interface
export interface ConversionJob {
  id: string;
  originalPath: string;
  originalFilename: string;
  options: ConversionOptions;
  status: 'uploading' | 'uploaded' | 'processing' | 'complete' | 'error';
  mp3Path?: string;
  error?: string;
  ws?: WebSocket; // Optionally associate with the submitting client
  completedAt?: number; // Timestamp when job was completed
  uploadProgress?: number; // Percentage of upload completed
  conversionProgress?: number; // Percentage of conversion completed
}

const conversionQueue: ConversionJob[] = [];
const completedJobs: ConversionJob[] = [];
let isProcessing = false;

// Function to broadcast queue updates
export const broadcastQueueStatus = () => {
  const queueStatus = conversionQueue.map(job => ({ 
    id: job.id, 
    filename: job.originalFilename, 
    status: job.status,
    uploadProgress: job.uploadProgress || 0,
    conversionProgress: job.conversionProgress || 0
  }));
  const completedStatus = completedJobs.map(job => ({ 
    id: job.id, 
    filename: job.originalFilename, 
    status: job.status,
    uploadProgress: job.uploadProgress || 0,
    conversionProgress: job.conversionProgress || 0
  }));
  broadcast({ type: 'queue_update', queue: [...queueStatus, ...completedStatus] });
};

// Function to clean up old completed jobs
const cleanupCompletedJobs = () => {
  const now = Date.now();
  // Remove jobs older than 10 minutes
  const retentionPeriod = 10 * 60 * 1000; // 10 minutes in milliseconds
  while (completedJobs.length > 0 && now - (completedJobs[0].completedAt || 0) > retentionPeriod) {
    const oldJob = completedJobs.shift();
    console.log(`[Queue]: Removed old completed job ${oldJob?.id} from completed list.`);
    // Optionally, delete the output file if it exists
    if (oldJob && oldJob.mp3Path && fs.existsSync(oldJob.mp3Path)) {
      fs.unlink(oldJob.mp3Path, (err) => {
        if (err) console.error(`[Cleanup]: Failed to delete file ${oldJob.mp3Path}:`, err);
        else console.log(`[Cleanup]: Deleted file ${oldJob.mp3Path} for old job ${oldJob.id}`);
      });
    }
    // Also delete the original uploaded file for errored jobs if it exists
    if (oldJob && oldJob.status === 'error' && oldJob.originalPath && fs.existsSync(oldJob.originalPath)) {
      fs.unlink(oldJob.originalPath, (err) => {
        if (err) console.error(`[Cleanup]: Failed to delete original file ${oldJob.originalPath}:`, err);
        else console.log(`[Cleanup]: Deleted original file ${oldJob.originalPath} for old errored job ${oldJob.id}`);
      });
    }
  }
};

// Function to process the queue
const processQueue = async () => {
  if (isProcessing || conversionQueue.length === 0) {
    return; // Don't process if already processing or queue is empty
  }

  isProcessing = true;
  // Get the next job without removing it from the queue yet
  const job = conversionQueue[0]; 

  // Safety check in case the queue was cleared concurrently
  if (!job) {
    isProcessing = false;
    return; 
  }

  // Only proceed if the job is actually pending
  if (job.status !== 'uploaded') {
    console.warn(`[Queue]: Attempted to process job ${job.id} which is not uploaded (status: ${job.status}). Skipping.`);
    // Remove the non-uploaded job from the front if needed
    conversionQueue.shift(); // Remove the unexpected job from the front
    isProcessing = false;
    processQueue(); // Try processing the next one
    return;
  }

  console.log(`[Queue]: Processing job ${job.id} for ${job.originalFilename}`);
  job.status = 'processing';
  broadcastQueueStatus(); // Update clients: job is now processing

  try {
    // Define the progress handler for this job
    const progressHandler = (progress: { percent: number }) => {
      console.log(`[Progress] Job ${job.id}: ${progress.percent}%`);
      job.conversionProgress = progress.percent;
      broadcastQueueStatus();
    };

    // Perform the conversion, passing the progress handler
    const mp3Path = await convertVideoToMp3(job.originalPath, job.options, progressHandler);
    
    job.status = 'complete';
    job.mp3Path = mp3Path;
    console.log(`[Queue]: Job ${job.id} completed. Output: ${mp3Path}`);
    console.log(`[Queue]: Job ${job.id} marked complete. About to broadcast status.`);
    // Log the queue state right before broadcasting
    console.log('[Queue]: Broadcasting queue status after completion:', JSON.stringify(conversionQueue));
    // Broadcast status AFTER updating it, job is still in the queue
    broadcastQueueStatus();
    console.log(`[Queue]: Broadcasted queue_update for job ${job.id}. About to broadcast job_complete.`);
    // Send specific job complete message
    broadcast({ type: 'job_complete', jobId: job.id, filename: job.originalFilename, mp3Filename: path.basename(mp3Path) });
    console.log(`[Queue]: Broadcasted job_complete for job ${job.id}.`);

    // Delete the original uploaded file after successful conversion
    if (fs.existsSync(job.originalPath)) {
      fs.unlink(job.originalPath, (err) => {
        if (err) console.error(`[Cleanup]: Failed to delete original file ${job.originalPath}:`, err);
        else console.log(`[Cleanup]: Deleted original file ${job.originalPath} for completed job ${job.id}`);
      });
    }

  } catch (error: any) {
    console.error(`[Queue]: Job ${job.id} failed for ${job.originalFilename}:`, error);
    job.status = 'error';
    job.error = error.message || 'Unknown conversion error';
    // Broadcast status AFTER updating it, job is still in the queue
    broadcastQueueStatus(); 
    // Send specific job error message
    broadcast({ type: 'job_error', jobId: job.id, filename: job.originalFilename, error: job.error });
  } finally {
    // Now that processing for THIS job is done (success or error), 
    // move the job to completedJobs if successful, or remove if error
    conversionQueue.shift();
    if (job.status === 'complete' && job.mp3Path) {
      job.completedAt = Date.now();
      completedJobs.push(job);
      console.log(`[Queue]: Moved completed job ${job.id} to completed list. Total completed: ${completedJobs.length}`);
    } else if (job.status === 'error') {
      job.completedAt = Date.now();
      completedJobs.push(job);
      console.log(`[Queue]: Moved errored job ${job.id} to completed list. Total completed: ${completedJobs.length}`);
    }
    isProcessing = false;
    broadcastQueueStatus(); // Update clients about the new queue state
    console.log(`[Queue]: Removed job ${job.id} from active queue. Queue length now: ${conversionQueue.length}`);
    
    // Clean up old completed jobs
    cleanupCompletedJobs();
    
    // Check if there are more jobs to process
    if (conversionQueue.length > 0) {
        console.log(`[Queue]: More jobs waiting (${conversionQueue.length}), triggering next process cycle.`);
        processQueue();
    } else {
        console.log('[Queue]: No more jobs in queue.');
    }
  }
};

// Function to add a job to the queue
export const addJobToQueue = (job: ConversionJob) => {
  conversionQueue.push(job);
  processQueue();
};

// Function to get queue status
export const getQueueStatus = () => {
  const queueStatus = conversionQueue.map(job => ({ 
    id: job.id, 
    filename: job.originalFilename, 
    status: job.status 
  }));
  const completedStatus = completedJobs.map(job => ({ 
    id: job.id, 
    filename: job.originalFilename, 
    status: job.status 
  }));
  return { queue: [...queueStatus, ...completedStatus] };
};

// Function to get job by ID
export const getJobById = (jobId: string) => {
  return [...conversionQueue, ...completedJobs].find(j => j.id === jobId);
};

// Function to remove job from completed list
export const removeJobFromCompleted = (jobId: string) => {
  const index = completedJobs.findIndex(j => j.id === jobId);
  if (index !== -1) {
    completedJobs.splice(index, 1);
    console.log(`[Queue]: Removed downloaded job ${jobId} from completed list. Remaining: ${completedJobs.length}`);
    broadcastQueueStatus();
  }
}; 