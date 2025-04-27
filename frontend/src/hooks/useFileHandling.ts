import { useState, useCallback, ChangeEvent, RefObject, useEffect } from 'react';

interface UseFileHandlingArgs {
  videoRef: RefObject<HTMLVideoElement | null>; // Pass video ref for playback
  resetTrimState: () => void;
}

export function useFileHandling({ videoRef, resetTrimState }: UseFileHandlingArgs) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null); // Can be thumbnail (data URL) or full video (object URL)
  const [isPlayingFullVideo, setIsPlayingFullVideo] = useState<boolean>(false);

  // Effect to revoke object URL if it's the full video URL
  useEffect(() => {
    const currentVideoSrc = videoSrc; // Capture value for cleanup
    const playing = isPlayingFullVideo;

    return () => {
      // Only revoke if it was an object URL (full video) being played
      if (currentVideoSrc && playing && currentVideoSrc.startsWith('blob:')) {
        URL.revokeObjectURL(currentVideoSrc);
      }
    };
  }, [videoSrc, isPlayingFullVideo]); // Rerun when src or playing state changes

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      resetTrimState(); // Reset trim times on new file selection
      // Clean up previous video state
      setVideoSrc(null);
      setSelectedFile(null);
      setIsPlayingFullVideo(false);

      if (file) {
        setSelectedFile(file);
        // Generate thumbnail
        const tempUrl = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = tempUrl;
        video.crossOrigin = 'Anonymous';
        video.preload = 'metadata';

        video.onloadeddata = () => {
          video.currentTime = 1; // Seek for thumbnail
        };

        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnailUrl = canvas.toDataURL('image/png');
            setVideoSrc(thumbnailUrl); // Set thumbnail as preview
          }
          // Clean up temporary video element and URL
          URL.revokeObjectURL(tempUrl);
          video.remove();
        };

        video.onerror = () => {
          console.error('Error loading video for thumbnail.');
          URL.revokeObjectURL(tempUrl);
          video.remove();
          setSelectedFile(null); // Clear selection on error
        };
      } else {
        // No file selected, handled by initial cleanup
      }
    },
    [resetTrimState], // resetTrimState should be stable if wrapped in useCallback where defined
  );

  const handlePlayFullVideo = useCallback(() => {
    if (selectedFile && !isPlayingFullVideo) {
      const fullVideoUrl = URL.createObjectURL(selectedFile);
      setVideoSrc(fullVideoUrl);
      setIsPlayingFullVideo(true);
      // Attempt to play using the passed ref
      videoRef.current?.play().catch((error) => {
        console.error('Error playing video:', error);
        // Handle playback error? Maybe reset state?
        setIsPlayingFullVideo(false);
        setVideoSrc(null); // Or revert to thumbnail?
      });
    }
  }, [selectedFile, isPlayingFullVideo, videoRef]);

  return {
    selectedFile,
    setSelectedFile, // Expose setter for handleSubmit
    videoSrc,
    setVideoSrc, // Expose setter for handleSubmit
    isPlayingFullVideo,
    handleFileChange,
    handlePlayFullVideo,
  };
}
