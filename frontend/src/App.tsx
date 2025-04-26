import React, { useState, ChangeEvent, FormEvent, useEffect, useRef } from 'react';
import './App.css';

// Type for queue jobs received from backend
interface QueueJob {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
}

// Type for job progress
interface JobProgress {
  jobId: string;
  filename: string;
  progress: number;
}

// Simple component for the file uploader
function VideoUploader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null); // State for video preview URL
  const [uploading, setUploading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [queue, setQueue] = useState<QueueJob[]>([]);
  const [progress, setProgress] = useState<Record<string, JobProgress>>({}); // Store progress by jobId
  const ws = useRef<WebSocket | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);

  // Ref for the video element
  const videoRef = useRef<HTMLVideoElement>(null);

  // Effect to setup WebSocket connection and polling fallback
  useEffect(() => {
    // Variable to hold the WebSocket instance for this effect run
    let socket: WebSocket | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;

    // Only setup WebSocket if the ref is currently null
    // (handles subsequent mounts after initial setup/cleanup)
    if (!ws.current) {
      // Determine WebSocket URL (ws:// or wss://)
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Connect to the specific IP and port of the remote machine (will be proxied by setupProxy.js)
      const wsUrl = `${wsProto}//192.168.2.95:3000/app-ws`; // Use specific IP and port for remote access
      console.log('(Effect Run) Connecting WebSocket via proxy to:', wsUrl);
      console.log('Debug: Attempting WebSocket connection with URL:', wsUrl);
      socket = new WebSocket(wsUrl); // Assign to local variable

      // --- Attach event listeners BEFORE assigning to ref ---
      socket.onopen = () => {
        console.log('WebSocket Connected');
        setMessage('Connected to server.');
        // Stop polling if it was started
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
          console.log('WebSocket connected, stopping polling fallback.');
        }
      };

      socket.onclose = () => {
        console.log('WebSocket Disconnected');
        setMessage('Disconnected from server. Please refresh.');
        // Start polling as fallback if WebSocket closes
        if (!pollingInterval) {
          console.log('Starting polling fallback due to WebSocket disconnection.');
          pollingInterval = setInterval(fetchQueueStatus, 5000); // Poll every 5 seconds
        }
        // Clear the ref ONLY if it currently holds this specific socket instance
        if (ws.current === socket) {
          ws.current = null;
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
        setMessage('WebSocket connection error.');
        // Start polling as fallback if WebSocket errors
        if (!pollingInterval) {
          console.log('Starting polling fallback due to WebSocket error.');
          pollingInterval = setInterval(fetchQueueStatus, 5000); // Poll every 5 seconds
        }
        // Clear the ref ONLY if it currently holds this specific socket instance
        if (ws.current === socket) {
          ws.current = null;
        }
      };

      socket.onmessage = (event) => {
        console.log('Debug: Raw WebSocket message received:', event.data);
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket Message Received:', data);

          switch (data.type) {
            case 'connection':
              setMessage(data.message);
              break;
            case 'queue_update':
              // Log the received queue data
              console.log('[WebSocket][queue_update]: Received queue data:', data.queue);
              console.log('[WebSocket][queue_update]: Updating state with new queue.');
              setQueue(data.queue);
              break;
            case 'job_progress':
              console.log('[WebSocket][job_progress]: Updating progress for job', data.jobId, 'to', data.progress);
              setProgress((prev) => ({ ...prev, [data.jobId]: data }));
              break;
            case 'job_complete':
            case 'job_error':
              console.log(`[WebSocket][job_complete/error]: Received for job ${data.jobId}. Removing progress.`);
              // Remove progress when job finishes or errors
              setProgress((prev) => {
                const newProgress = { ...prev };
                delete newProgress[data.jobId];
                return newProgress;
              });
              // Queue update will refresh status separately
              break;
            // Handle other message types (upload_success, etc.) if needed
            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      // --- Now assign to ref ---
      ws.current = socket;

      // Start polling as a fallback if WebSocket doesn't connect within a timeout
      pollingInterval = setTimeout(() => {
        if (socket && socket.readyState !== WebSocket.OPEN) {
          console.log('WebSocket did not connect in time, starting polling fallback.');
          pollingInterval = setInterval(fetchQueueStatus, 5000); // Poll every 5 seconds
        }
      }, 10000); // Wait 10 seconds before assuming WebSocket failed
    }

    // Function to fetch queue status from backend
    const fetchQueueStatus = async () => {
      try {
        const response = await fetch('/queue-status');
        if (response.ok) {
          const data = await response.json();
          console.log('[Polling]: Received queue data:', data.queue);
          setQueue(data.queue);
        } else {
          console.error('[Polling]: Failed to fetch queue status:', response.statusText);
        }
      } catch (error) {
        console.error('[Polling]: Error fetching queue status:', error);
      }
    };

    // Cleanup function
    return () => {
      // Use the local `socket` variable captured by this effect's closure
      if (socket) {
        console.log(`(Cleanup) Checking WebSocket state (readyState: ${socket.readyState})`);
        // Only explicitly close if it's already OPEN.
        if (socket.readyState === WebSocket.OPEN) {
          console.log('(Cleanup) Closing OPEN WebSocket');
          socket.close();
        } else {
          console.log('(Cleanup) WebSocket not OPEN, leaving it to close/error naturally.');
        }
        // Still nullify the ref if it points to this socket, regardless of whether we closed it.
        // This allows the second mount in StrictMode to proceed correctly.
        if (ws.current === socket) {
          console.log('(Cleanup) Nullifying ws.current ref');
          ws.current = null;
        }
      } else {
        console.log('(Cleanup) No socket created in this effect run, nothing to close.');
      }
      // Clean up polling interval if it exists
      if (pollingInterval) {
        clearInterval(pollingInterval);
        clearTimeout(pollingInterval);
        console.log('(Cleanup) Cleared polling interval/timeout.');
      }
    };
    // End of cleanup function
  }, []); // End of useEffect dependencies

  const resetTrimState = () => {
    setDuration(0);
    setStartTime(0);
    setEndTime(0);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    resetTrimState(); // Reset trim times on new file selection
    if (file) {
      setSelectedFile(file);
      setMessage('');
      // Create object URL for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setVideoSrc(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      setVideoSrc(null); // Clear preview
    }
  };

  // Effect to revoke object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  // Handler for when video metadata is loaded
  const handleMetadataLoaded = () => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      console.log('Video duration:', videoDuration);
      setDuration(videoDuration);
      // Initialize endTime only if it hasn't been set or is 0
      // This prevents resetting if the user changes the file after setting trim times
      if (endTime === 0 || endTime > videoDuration) {
        setEndTime(videoDuration);
      }
      // Reset start time only if it's beyond the new duration
      if (startTime >= videoDuration) {
        setStartTime(0);
      }
    }
  };

  // Handlers for trim controls
  const handleStartTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newStartTime = parseFloat(event.target.value);
    if (!isNaN(newStartTime) && newStartTime <= endTime && newStartTime >= 0) {
      setStartTime(newStartTime);
    } else if (newStartTime > endTime) {
      setStartTime(endTime); // Prevent start exceeding end
    } else if (newStartTime < 0) {
      setStartTime(0); // Prevent negative start time
    }
  };

  const handleEndTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newEndTime = parseFloat(event.target.value);
    if (!isNaN(newEndTime) && newEndTime >= startTime && newEndTime <= duration) {
      setEndTime(newEndTime);
    } else if (newEndTime < startTime) {
      setEndTime(startTime); // Prevent end being before start
    } else if (newEndTime > duration) {
      setEndTime(duration); // Prevent end exceeding duration
    }
  };

  // Function to format time (MM:SS.ms)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.round((timeInSeconds - Math.floor(timeInSeconds)) * 100); // Two decimal places for ms
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setMessage('Please select a video file first.');
      return;
    }
    setUploading(true);
    setMessage(`Uploading ${selectedFile.name}...`);
    const formData = new FormData();
    formData.append('video', selectedFile);
    if (startTime !== 0 || endTime !== duration) {
      formData.append('startTime', startTime.toString());
      formData.append('endTime', endTime.toString());
      console.log(`Appending trim times: start=${startTime}, end=${endTime}`);
    }
    try {
      // Use relative path which will be proxied by CRA dev server
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (response.ok && response.status === 202) {
        // Check for 202 Accepted
        setMessage(`Upload queued! Job ID: ${result.jobId}.`);
        console.log('Upload queued:', result);
      } else {
        // Handle immediate errors from server before queueing
        setMessage(`Upload failed: ${result.message || response.statusText || 'Server error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage(`Upload error: ${error instanceof Error ? error.message : 'Network error'}`);
    } finally {
      setUploading(false);
      setSelectedFile(null);
      // Reset file input visually
      if (event.target instanceof HTMLFormElement) {
        event.target.reset();
      }
      resetTrimState(); // Reset trim state after upload attempt
      setVideoSrc(null);
    }
  };

  return (
    <div className="video-uploader">
      <h2>Upload Video for MP3 Conversion</h2>
      <form onSubmit={handleSubmit}>
        <input type="file" accept="video/*" onChange={handleFileChange} disabled={uploading} />
        {/* Conditionally display video preview */}
        {videoSrc && (
          <div className="video-preview">
            <h3>Preview:</h3>
            <video ref={videoRef} controls width="320" src={videoSrc} onLoadedMetadata={handleMetadataLoaded}></video>
            {/* Display Duration */}
            {duration > 0 && (
              <div className="trim-controls">
                <h4>Trim Video:</h4>
                <p>Total Duration: {formatTime(duration)}</p>
                {/* Start Time Controls */}
                <div className="control-group">
                  <label htmlFor="startTime">Start:</label>
                  <input
                    type="range"
                    id="startTimeRange"
                    name="startTimeRange"
                    min="0"
                    max={duration}
                    step="0.01"
                    value={startTime}
                    onChange={handleStartTimeChange}
                  />
                  <input
                    type="number"
                    id="startTime"
                    name="startTime"
                    min="0"
                    max={duration}
                    step="0.01"
                    value={startTime.toFixed(2)}
                    onChange={handleStartTimeChange}
                  />
                  <span>{formatTime(startTime)}</span>
                </div>
                {/* End Time Controls */}
                <div className="control-group">
                  <label htmlFor="endTime">End:</label>
                  <input
                    type="range"
                    id="endTimeRange"
                    name="endTimeRange"
                    min="0"
                    max={duration}
                    step="0.01"
                    value={endTime}
                    onChange={handleEndTimeChange}
                  />
                  <input
                    type="number"
                    id="endTime"
                    name="endTime"
                    min="0"
                    max={duration}
                    step="0.01"
                    value={endTime.toFixed(2)}
                    onChange={handleEndTimeChange}
                  />
                  <span>{formatTime(endTime)}</span>
                </div>
                {/* Display Selected Duration */}
                <p>Selected Duration: {formatTime(endTime - startTime)}</p>
              </div>
            )}
            {/* TODO: Add trim controls UI (sliders, number inputs) here */}
          </div>
        )}
        <button type="submit" disabled={!selectedFile || uploading}>
          {/* Use a more descriptive button text now */}
          {uploading
            ? 'Uploading...'
            : startTime !== 0 || endTime !== duration
              ? 'Trim & Convert'
              : 'Convert Full Video'}
        </button>
      </form>
      {message && <p className="message">{message}</p>}

      {/* Display Queue */}
      <div className="queue-status">
        <h3>Conversion Queue</h3>
        {queue.length === 0 ? (
          <p>Queue is empty.</p>
        ) : (
          <ul>
            {queue.map((job) => (
              <li key={job.id}>
                {job.filename} - {job.status}
                {/* Display progress if processing */}
                {job.status === 'processing' && progress[job.id] && (
                  <span> ({progress[job.id].progress.toFixed(1)}%)</span>
                )}
                {/* Add download button for completed jobs */}
                {job.status === 'complete' && (
                  <a
                    href={`/download/${job.id}`}
                    download={`${job.filename.replace(/\.[^/.]+$/, '')}.mp3`}
                    className="download-link"
                  >
                    Download MP3
                  </a>
                )}
                {/* TODO: Add download button for completed jobs */}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Main App component
function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Vid2Audio Web UI</h1>
      </header>
      <main>
        <VideoUploader />
      </main>
    </div>
  );
}

export default App;
