import React, { useState, FormEvent, useRef } from 'react';
// Assuming App.css contains styles for .video-uploader and potentially shared styles
// If not, create VideoUploader.css and import it
import '../../App.css';
import './VideoUploader.css';
import { useTrimming } from '../../hooks/useTrimming';
import { useConversionStatus } from '../../hooks/useConversionStatus';
import { useFileHandling } from '../../hooks/useFileHandling';
import FileInput from '../FileInput/FileInput';
import VideoPreview from '../VideoPreview/VideoPreview';
import TrimControls from '../TrimControls/TrimControls';
import QueueDisplay from '../QueueDisplay/QueueDisplay';

const VideoUploader: React.FC = () => {
  // State managed by hooks:
  // selectedFile, videoSrc, isPlayingFullVideo (useFileHandling)
  // duration, startTime, endTime (useTrimming)
  // queue (useConversionStatus)

  // Remaining local state:
  const [uploading, setUploading] = useState<boolean>(false);

  // Ref for the video element
  const videoRef = useRef<HTMLVideoElement>(null);

  // Trimming Hook
  const {
    duration,
    startTime,
    endTime,
    resetTrimState,
    handleMetadataLoaded,
    handleStartTimeChange,
    handleEndTimeChange,
  } = useTrimming({ videoRef });

  // Conversion Status Hook
  const { queue } = useConversionStatus();

  // File Handling Hook
  const {
    selectedFile,
    setSelectedFile,
    videoSrc,
    setVideoSrc,
    isPlayingFullVideo,
    handleFileChange,
    handlePlayFullVideo,
  } = useFileHandling({ resetTrimState, videoRef });

  // Submit handler
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('video', selectedFile);
    if (startTime !== 0 || endTime !== duration) {
      formData.append('startTime', startTime.toString());
      formData.append('endTime', endTime.toString());
      console.log(`Appending trim times: start=${startTime}, end=${endTime}`);
    }
    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (response.ok && response.status === 202) {
        console.log('Upload queued:', result);
      } else {
        console.error('Upload error from server:', result);
      }
    } catch (error) {
      console.error('Upload fetch error:', error);
    } finally {
      setUploading(false);
      setSelectedFile(null);
      if (event.target instanceof HTMLFormElement) {
        event.target.reset();
      }
      resetTrimState();
      setVideoSrc(null);
    }
  };

  return (
    <div className="video-uploader">
      <h2>Upload Video for MP3 Conversion</h2>
      <form onSubmit={handleSubmit}>
        <FileInput selectedFile={selectedFile} onChange={handleFileChange} />
        <VideoPreview
          videoSrc={videoSrc}
          isPlayingFullVideo={isPlayingFullVideo}
          videoRef={videoRef}
          onPlayClick={handlePlayFullVideo}
          onMetadataLoaded={handleMetadataLoaded}
        />
        <TrimControls
          duration={duration}
          startTime={startTime}
          endTime={endTime}
          onStartTimeChange={handleStartTimeChange}
          onEndTimeChange={handleEndTimeChange}
        />
        <button type="submit" disabled={!selectedFile || uploading}>
          {uploading
            ? 'Uploading...'
            : startTime !== 0 || endTime !== duration
              ? 'Trim & Convert'
              : 'Convert Full Video'}
        </button>
      </form>
      <QueueDisplay
        queue={queue}
        uploading={uploading}
        uploadingFilename={uploading ? (selectedFile?.name ?? null) : null}
      />
    </div>
  );
};

export default VideoUploader;
