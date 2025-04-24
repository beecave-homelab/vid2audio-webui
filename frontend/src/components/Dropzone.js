import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

const Dropzone = ({ onFileAccepted, disabled }) => {
  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) {
      onFileAccepted(acceptedFiles[0]);
    }
  }, [onFileAccepted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v']
    },
    maxSize: 2147483648, // 2GB
    multiple: false
  });

  return (
    <div 
      {...getRootProps()} 
      className={`dropzone ${isDragActive ? 'dropzone-active' : ''}`}
    >
      <input {...getInputProps()} />
      <div className="dropzone-icon">
        <i className="fas fa-cloud-upload-alt">📁</i>
      </div>
      {isDragActive ? (
        <p>Drop the video file here...</p>
      ) : (
        <>
          <p>Drag & drop a video file here, or click to select</p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Supported formats: MP4, AVI, MOV, MKV, WMV, FLV, WEBM, M4V (Max: 2GB)
          </p>
        </>
      )}
    </div>
  );
};

export default Dropzone;
