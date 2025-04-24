import React, { useState, useCallback } from 'react';
import './styles/App.css';
import Dropzone from './components/Dropzone';
import FileConversion from './components/FileConversion';

function App() {
  const [file, setFile] = useState(null);
  const [fileId, setFileId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [conversionComplete, setConversionComplete] = useState(false);

  const handleFileAccepted = useCallback(async (acceptedFile) => {
    setFile(acceptedFile);
    setError(null);
    setUploading(true);
    setUploadProgress(0);
    setFileId(null);
    setConversionComplete(false);

    // Create FormData
    const formData = new FormData();
    formData.append('file', acceptedFile);

    try {
      // Upload file with progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          setFileId(response.file_id);
          setUploading(false);
        } else {
          throw new Error(`Upload failed with status ${xhr.status}`);
        }
      });

      xhr.upload.addEventListener('error', () => {
        throw new Error('Upload failed due to network error');
      });

      xhr.open('POST', '/api/upload/');
      xhr.send(formData);
    } catch (err) {
      setError(err.message || 'Failed to upload file');
      setUploading(false);
    }
  }, []);

  const handleConversionComplete = useCallback(() => {
    setConversionComplete(true);
  }, []);

  const handleConversionError = useCallback((errorMessage) => {
    setError(errorMessage);
  }, []);

  const handleReset = useCallback(() => {
    setFile(null);
    setFileId(null);
    setUploading(false);
    setUploadProgress(0);
    setError(null);
    setConversionComplete(false);
  }, []);

  return (
    <div className="container">
      <div className="header">
        <h1>Video to MP3 Converter</h1>
        <p>Upload a video file and convert it to MP3 audio format</p>
      </div>

      <div className="upload-container">
        {!file ? (
          <Dropzone 
            onFileAccepted={handleFileAccepted} 
            disabled={uploading}
          />
        ) : (
          <div className="file-info">
            <h3>File: {file.name}</h3>
            <p>Size: {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            <p>Type: {file.type}</p>
            
            {uploading ? (
              <div className="progress-container">
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="progress-status">
                  <p>Uploading...</p>
                  <p>{uploadProgress}%</p>
                </div>
              </div>
            ) : fileId ? (
              <FileConversion 
                fileId={fileId}
                onComplete={handleConversionComplete}
                onError={handleConversionError}
              />
            ) : null}
            
            {error && (
              <div className="error-message">{error}</div>
            )}
            
            {(error || conversionComplete) && (
              <button 
                className="button" 
                onClick={handleReset}
                style={{ marginTop: '1rem' }}
              >
                Convert Another File
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
