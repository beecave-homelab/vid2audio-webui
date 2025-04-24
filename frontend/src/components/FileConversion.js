import React, { useState, useEffect, useCallback } from 'react';
import useWebSocket from '../hooks/useWebSocket';

// Helper to get the base URL for API calls (HTTP/HTTPS)
const getApiBaseUrl = () => {
  // Use relative paths, let the browser handle the full URL
  return ''; 
};

// Helper to get the WebSocket URL (WS/WSS)
const getWebSocketUrl = (path) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
};

const FileConversion = ({ fileId, onComplete, onError }) => {
  const [status, setStatus] = useState('queued');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);

  // Construct dynamic WebSocket URL
  const wsUrl = getWebSocketUrl(`/api/ws/${fileId}`);
  const { lastMessage } = useWebSocket(wsUrl);

  // API Base URL (relative)
  const apiBaseUrl = getApiBaseUrl();

  // Check initial status using relative path
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/status/${fileId}`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch conversion status: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        setStatus(data.status);
        setProgress(parseFloat(data.progress) || 0);

        if (data.message) {
          setMessage(data.message);
        }

        if (data.status === 'completed') {
          // Use relative path for download URL
          setDownloadUrl(`${apiBaseUrl}/api/download/${fileId}`);
          onComplete && onComplete(fileId);
        } else if (data.status === 'failed') {
          setError(data.message || 'Conversion failed');
          onError && onError(data.message || 'Conversion failed');
        }
      } catch (err) {
        console.error("Error checking status:", err);
        setError(err.message);
        onError && onError(err.message);
      }
    };

    checkStatus();
  }, [fileId, onComplete, onError, apiBaseUrl]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      console.log('WebSocket message received:', lastMessage.data);
      try {
        const data = JSON.parse(lastMessage.data);
        console.log('Parsed WebSocket data:', data);

        if (data.file_id === fileId) {
          console.log(`Updating state: status=${data.status}, progress=${data.progress}`);
          setStatus(data.status);
          setProgress(data.progress !== undefined ? parseFloat(data.progress) : progress); // Use parseFloat and handle undefined

          if (data.message) {
            setMessage(data.message);
          }

          if (data.status === 'completed') {
            // Use relative path for download URL
            setDownloadUrl(`${apiBaseUrl}/api/download/${fileId}`);
            onComplete && onComplete(fileId);
          } else if (data.status === 'failed') {
            setError(data.message || 'Conversion failed');
            onError && onError(data.message || 'Conversion failed');
          }
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
        // Optionally set an error state here
        // setError('Error processing status update.');
        // onError && onError('Error processing status update.');
      }
    }
  }, [lastMessage, fileId, onComplete, onError, apiBaseUrl]);

  // Use the relative downloadUrl directly for the link
  // The browser will resolve it correctly

  return (
    <div className="file-conversion">
      {error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <div className="progress-container">
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-status">
              <p>{status.charAt(0).toUpperCase() + status.slice(1)}</p>
              <p>{typeof progress === 'number' ? progress.toFixed(1) : '0.0'}%</p>
            </div>
            {message && <p className="progress-message">{message}</p>}
          </div>
          
          {status === 'completed' && downloadUrl && (
            <div className="download-container">
              <a
                href={downloadUrl} 
                className="button button-secondary" 
                download
              >
                Download MP3
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FileConversion;
