import express, { Express, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http'; // Import http server
import { WebSocketServer, WebSocket } from 'ws'; // Import WebSocket server
import { convertVideoToMp3, ConversionOptions, ProgressCallback } from './converter'; // Import the converter function and ConversionOptions
import { v4 as uuidv4 } from 'uuid'; // Import uuid for job IDs

const app: Express = express();
const server = createServer(app); // Create HTTP server from Express app

// --- WebSocket Server Setup ---
// Define the path for application WebSocket connections
const wsPath = '/app-ws';

// Initialize WebSocketServer, but don't attach it to the main server yet
const wss = new WebSocketServer({ noServer: true });

const port = process.env.PORT || 3001; // Default to 3001 if PORT not set

// --- Directory Setup ---
// Use path.resolve to get absolute paths relative to the backend project root
const backendRoot = path.resolve(__dirname, '..'); 
const uploadDir = path.join(backendRoot, 'uploads');
const outputDir = path.join(backendRoot, 'outputs');

// Ensure directories exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Created upload directory: ${uploadDir}`);
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created output directory: ${outputDir}`);
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

const upload = multer({ storage: storage });

// Store connected clients
const clients = new Set<WebSocket>();

// WebSocket connection handler
wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket]: Client connected');
  clients.add(ws);

  ws.on('message', (message: Buffer) => {
    // Handle messages from clients if needed (e.g., initial config)
    console.log('[WebSocket]: Received:', message.toString());
    // For now, just echo back
    ws.send(`Server received: ${message.toString()}`);
  });

  ws.on('close', () => {
    console.log('[WebSocket]: Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket]: Error:', error);
    clients.delete(ws); // Remove client on error
  });

  // Send a welcome message
  ws.send(JSON.stringify({ type: 'connection', message: 'Connected to Vid2Audio WebSocket' }));
});

// Handle server upgrade requests specifically for the WebSocket path
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url;
  if (pathname === wsPath) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    // For other paths, destroy the socket
    socket.destroy();
  }
});

// Function to broadcast messages to all connected clients
const broadcast = (message: any) => {
  const messageString = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageString);
    }
  });
};

// --- Conversion Queue ---
interface ConversionJob {
  id: string;
  originalPath: string;
  originalFilename: string;
  options: ConversionOptions;
  status: 'pending' | 'processing' | 'complete' | 'error';
  mp3Path?: string;
  error?: string;
  ws?: WebSocket; // Optionally associate with the submitting client
  completedAt?: number; // Timestamp when job was completed
}

const conversionQueue: ConversionJob[] = [];
const completedJobs: ConversionJob[] = [];
let isProcessing = false;

// Function to broadcast queue updates
const broadcastQueueStatus = () => {
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
  }
};

// --- Queue Processing Logic ---
const processQueue = async () => {
  if (isProcessing || conversionQueue.length === 0) {
    return; // Don't process if already processing or queue is empty
  }

  isProcessing = true;
  // Get the next job without removing it from the queue yet
  const job = conversionQueue[0]; 

  // Safety check in case the queue was cleared concurrently (unlikely here but good practice)
  if (!job) {
    isProcessing = false;
    return; 
  }

  // Only proceed if the job is actually pending
  if (job.status !== 'pending') {
    console.warn(`[Queue]: Attempted to process job ${job.id} which is not pending (status: ${job.status}). Skipping.`);
    // Remove the non-pending job from the front if needed, or handle differently.
    // For now, just stop processing this cycle and let the next trigger handle it.
    // We might need a mechanism to remove stale/unexpected jobs.
    conversionQueue.shift(); // Remove the unexpected job from the front
    isProcessing = false;
    processQueue(); // Try processing the next one
    return;
  }

  console.log(`[Queue]: Processing job ${job.id} for ${job.originalFilename}`);
  job.status = 'processing';
  broadcastQueueStatus(); // Update clients: job is now processing (and still in the queue)

  try {
    // Define the progress handler for this job
    const progressHandler: ProgressCallback = (progress) => {
      console.log(`[Progress] Job ${job.id}: ${progress.percent}%`);
      broadcast({ 
        type: 'job_progress', 
        jobId: job.id, 
        filename: job.originalFilename,
        progress: progress.percent 
      });
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
    // Send specific job complete message (optional, frontend might just use queue_update)
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
    // Send specific job error message (optional)
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
      // Optionally delete the original file for errored job
      if (fs.existsSync(job.originalPath)) {
        fs.unlink(job.originalPath, (err) => {
          if (err) console.error(`[Cleanup]: Failed to delete original file ${job.originalPath}:`, err);
          else console.log(`[Cleanup]: Deleted original file ${job.originalPath} for errored job ${job.id}`);
        });
      }
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

// --- Express Routes ---
app.get('/', (req, res) => {
  res.send('Vid2Audio Backend API');
});

// Endpoint for file upload
app.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  console.log('File uploaded successfully:', req.file.path);
  broadcast({ type: 'upload_success', filename: req.file.originalname });

  // Get startTime and endTime from req.body (sent as strings)
  const { startTime: startTimeStr, endTime: endTimeStr } = req.body;
  const conversionOptions: ConversionOptions = {};

  // Parse and validate trim times
  const startTime = parseFloat(startTimeStr);
  const endTime = parseFloat(endTimeStr);

  if (!isNaN(startTime) && startTime >= 0) {
    conversionOptions.startTime = startTime;
    console.log(`Using startTime: ${startTime}`);
  }
  if (!isNaN(endTime) && endTime > 0 && (isNaN(startTime) || endTime > startTime)) {
    conversionOptions.endTime = endTime;
     console.log(`Using endTime: ${endTime}`);
  } else if (!isNaN(endTime)) {
     console.warn(`Invalid endTime (${endTime}) received, ignoring.`);
  }

  // Create a new job
  const jobId = uuidv4();
  const newJob: ConversionJob = {
    id: jobId,
    originalPath: req.file.path,
    originalFilename: req.file.originalname,
    options: conversionOptions,
    status: 'pending'
    // TODO: Associate ws client if needed for direct feedback?
  };

  // Add job to the queue
  conversionQueue.push(newJob);
  console.log(`[Queue]: Job ${jobId} added for ${newJob.originalFilename}`);
  broadcastQueueStatus();

  // Trigger processing if not already running
  processQueue(); 

  // Respond to the client immediately that the job is queued
  res.status(202).json({ 
    message: 'File uploaded and queued for conversion.',
    jobId: jobId,
    filename: newJob.originalFilename,
    queuePosition: conversionQueue.length // Current position (1-based)
  }); 

  // Conversion logic moved to a separate processor function
});

// Endpoint for downloading completed files
app.get('/download/:jobId', (req: Request, res: Response) => {
  const jobId = req.params.jobId;
  // Find the job in memory (NOTE: In a real app, use a database)
  const job = [...conversionQueue, ...completedJobs].find(j => j.id === jobId);
  
  // In a more robust system, you might also check completed jobs persisted elsewhere
  // For this example, we only check the current queue state.

  if (!job) {
    // Maybe the job never existed, or the server restarted clearing the queue.
    // Check if the file exists directly in the output folder might be an alternative
    // But relying on finding the job metadata is safer for status check.
    return res.status(404).send('Job not found or server restarted.');
  }

  if (job.status !== 'complete' || !job.mp3Path) {
    return res.status(400).send('Job is not complete or output file is missing.');
  }

  // Check if the file actually exists on disk
  if (!fs.existsSync(job.mp3Path)) {
    console.error(`[Download]: File not found on disk for job ${jobId}: ${job.mp3Path}`);
    // This might happen if the output files were manually deleted or moved
    // Update job status maybe? For now, return error.
    job.status = 'error'; // Mark job as error if file is missing
    job.error = 'Output file missing from server.';
    broadcastQueueStatus();
    return res.status(500).send('Output file not found on server.');
  }

  console.log(`[Download]: Sending file for job ${jobId}: ${job.mp3Path}`);
  // Use res.download to trigger browser download with the correct filename
  // Extract the base filename to suggest to the browser
  const downloadFilename = path.basename(job.mp3Path); 
  res.download(job.mp3Path, downloadFilename, (err) => {
    if (err) {
      // Handle errors that might occur during streaming the file
      console.error(`[Download]: Error sending file for job ${jobId}:`, err);
      // Avoid sending another response if headers were already sent
      if (!res.headersSent) {
        res.status(500).send('Error occurred during file download.');
      }
    } else {
       console.log(`[Download]: Successfully sent file for job ${jobId}`);
       // Remove the job from completedJobs after successful download
       const index = completedJobs.findIndex(j => j.id === jobId);
       if (index !== -1) {
         completedJobs.splice(index, 1);
         console.log(`[Queue]: Removed downloaded job ${jobId} from completed list. Remaining: ${completedJobs.length}`);
         broadcastQueueStatus();
         // Optionally, delete the output file after download
         if (job.mp3Path && fs.existsSync(job.mp3Path)) {
           fs.unlink(job.mp3Path, (err) => {
             if (err) console.error(`[Cleanup]: Failed to delete file ${job.mp3Path}:`, err);
             else console.log(`[Cleanup]: Deleted file ${job.mp3Path} for downloaded job ${jobId}`);
           });
         }
       }
    }
  });
});

// Endpoint for getting current queue status (for polling fallback)
app.get('/queue-status', (req: Request, res: Response) => {
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
  res.json({ queue: [...queueStatus, ...completedStatus] });
});

// Start the server
server.listen(port, () => {
  console.log(`[server]: Server (HTTP + WebSocket) is running at http://localhost:${port}`);
  // Start processing the queue if there are jobs on startup (e.g., after a restart)
  processQueue(); 
}); 