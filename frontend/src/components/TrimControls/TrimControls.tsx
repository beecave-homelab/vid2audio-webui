import React, { ChangeEvent } from 'react';
import { formatTime } from '../../utils/formatTime';
import './TrimControls.css';

interface TrimControlsProps {
  duration: number;
  startTime: number;
  endTime: number;
  onStartTimeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onEndTimeChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const TrimControls: React.FC<TrimControlsProps> = ({
  duration,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
}) => {
  if (duration <= 0) {
    return null; // Don't render if duration isn't loaded
  }

  return (
    <div className="trim-controls">
      <div className="time-info">
        <span>Total Duration: {formatTime(duration)}</span>
        <span>Selected Duration: {formatTime(endTime - startTime)}</span>
      </div>
      <div className="slider-container">
        {/* Start Time Slider */}
        <input
          type="range"
          min={0}
          max={duration} // Max is full duration
          step={0.1}
          value={startTime}
          onChange={onStartTimeChange}
          className="time-slider"
        />
        {/* End Time Slider */}
        <input
          type="range"
          min={startTime} // Min is current start time
          max={duration + 0.00001} // Allow reaching the very end
          step="0.001" // Finer control for end slider if needed
          value={endTime}
          onChange={onEndTimeChange}
          className="time-slider"
          required
        />
      </div>
      <div className="time-inputs">
        <div>
          <label>Start Time (seconds): </label>
          <input
            type="number"
            min={0}
            max={endTime} // Cannot exceed end time
            step={0.0001}
            value={startTime.toFixed(4)}
            onChange={onStartTimeChange}
            className="time-input"
          />
        </div>
        <div>
          <label>End Time (seconds): </label>
          <input
            type="number"
            min={startTime} // Cannot be less than start time
            max={duration + 0.00001} // Allow reaching the very end
            step={0.0001}
            value={endTime.toFixed(4)}
            onChange={onEndTimeChange}
            className="time-input"
          />
        </div>
      </div>
    </div>
  );
};

export default TrimControls;
