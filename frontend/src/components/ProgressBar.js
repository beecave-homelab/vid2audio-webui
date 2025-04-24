import React from 'react';

const ProgressBar = ({ progress, status, message }) => {
  return (
    <div className="progress-container">
      <div className="progress-bar-container">
        <div 
          className="progress-bar" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="progress-status">
        <p>{status}</p>
        <p>{progress.toFixed(1)}%</p>
      </div>
      {message && <p className="progress-message">{message}</p>}
    </div>
  );
};

export default ProgressBar;
