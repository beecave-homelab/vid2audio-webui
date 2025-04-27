import { useState, useCallback, ChangeEvent, RefObject } from 'react';

interface UseTrimmingArgs {
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function useTrimming({ videoRef }: UseTrimmingArgs) {
  const [duration, setDuration] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);

  const resetTrimState = useCallback(() => {
    setDuration(0);
    setStartTime(0);
    setEndTime(0);
  }, []);

  // Handler for when video metadata is loaded
  const handleMetadataLoaded = useCallback(() => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      console.log('Video duration:', videoDuration);
      setDuration(videoDuration);
      // Initialize endTime only if it hasn't been set or is 0
      // This prevents resetting if the user changes the file after setting trim times
      if (endTime === 0 || endTime > videoDuration) {
        setEndTime(videoDuration); // Set to exact duration without rounding
      }
      // Reset start time only if it's beyond the new duration
      if (startTime >= videoDuration) {
        setStartTime(0);
      }
    }
  }, [videoRef, endTime, startTime]); // Include endTime and startTime in deps

  // Handlers for trim controls
  const handleStartTimeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const newStartTime = parseFloat(event.target.value);
      if (!isNaN(newStartTime) && newStartTime <= endTime && newStartTime >= 0) {
        setStartTime(newStartTime);
      } else if (newStartTime > endTime) {
        setStartTime(endTime); // Prevent start exceeding end
      } else if (newStartTime < 0) {
        setStartTime(0); // Prevent negative start time
      }
    },
    [endTime], // Dependency on endTime
  );

  const handleEndTimeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const newEndTime = parseFloat(event.target.value);
      if (!isNaN(newEndTime) && newEndTime >= startTime && newEndTime <= duration) {
        setEndTime(newEndTime);
      } else if (newEndTime < startTime) {
        setEndTime(startTime); // Prevent end being before start
      } else if (newEndTime > duration) {
        setEndTime(duration); // Prevent end exceeding duration
      }
    },
    [startTime, duration], // Dependency on startTime and duration
  );

  return {
    duration,
    startTime,
    endTime,
    resetTrimState,
    handleMetadataLoaded,
    handleStartTimeChange,
    handleEndTimeChange,
  };
}
