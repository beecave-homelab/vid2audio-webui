import React from 'react';
import { QueueJob } from '../../utils/types';
import './QueueDisplay.css';

interface QueueDisplayProps {
  queue: QueueJob[];
  uploading: boolean;
  uploadingFilename: string | null;
}

const QueueDisplay: React.FC<QueueDisplayProps> = ({ queue, uploading, uploadingFilename }) => {
  return (
    <div className="queue-status">
      <h3>Conversion Queue</h3>
      {queue.length === 0 && !uploading ? (
        <p>Queue is empty.</p>
      ) : (
        <table className="queue-table">
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Filename</th>
              <th>Status</th>
              <th>Upload Progress</th>
              <th>Conversion Progress</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {/* Display temporary row during upload */}
            {uploading && uploadingFilename && (
              <tr key="uploading-temp">
                <td>N/A</td>
                <td>{uploadingFilename}</td>
                <td>Uploading...</td>
                <td>N/A</td>
                <td>N/A</td>
                <td>N/A</td>
              </tr>
            )}
            {/* Map existing queue items */}
            {queue.map((job) => (
              <tr key={job.id}>
                <td>{job.id.substring(0, 8)}...</td>
                <td>{job.filename}</td>
                <td>{job.status.charAt(0).toUpperCase() + job.status.slice(1)}</td>
                <td>{(job.uploadProgress || 0).toFixed(1)}%</td>
                <td>{(job.conversionProgress || 0).toFixed(1)}%</td>
                <td>
                  {job.status === 'complete' && (
                    <a
                      href={`/download/${job.id}`}
                      download={`${job.filename.replace(/\.[^/.]+$/, '')}.mp3`}
                      className="download-link"
                    >
                      Download MP3
                    </a>
                  )}
                  {job.status === 'error' && (
                    <span className="error-message">Conversion failed. Check logs or video format.</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default QueueDisplay;
