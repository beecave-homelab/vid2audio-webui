import React, { RefObject } from 'react';
import './VideoPreview.css';

interface VideoPreviewProps {
  videoSrc: string | null;
  isPlayingFullVideo: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onPlayClick: () => void;
  onMetadataLoaded: () => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoSrc,
  isPlayingFullVideo,
  videoRef,
  onPlayClick,
  onMetadataLoaded,
}) => {
  if (!videoSrc) {
    return null; // Don't render anything if there's no source
  }

  return (
    <div className="video-preview-container">
      {!isPlayingFullVideo ? (
        <div className="thumbnail-container">
          <img src={videoSrc} alt="Video Thumbnail" className="video-thumbnail" />
          <button type="button" onClick={onPlayClick} className="play-button">
            Play & Trim Video
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          className="video-preview"
          onLoadedMetadata={onMetadataLoaded}
          // autoPlay could be added here if desired after clicking play
        />
      )}
      {/* Trim controls will be rendered separately outside this component */}
    </div>
  );
};

export default VideoPreview;
