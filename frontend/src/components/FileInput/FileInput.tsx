import React, { ChangeEvent } from 'react';
import './FileInput.css';

interface FileInputProps {
  selectedFile: File | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  id?: string;
}

const FileInput: React.FC<FileInputProps> = ({ selectedFile, onChange, id = 'videoFile' }) => {
  return (
    <div className="file-input-container">
      <input
        type="file"
        id={id}
        accept="video/*"
        onChange={onChange}
        className="file-input"
        // Resetting visually is handled by form.reset() in handleSubmit
      />
      <label htmlFor={id} className="file-input-label">
        {selectedFile ? selectedFile.name : 'Choose a video file'}
      </label>
    </div>
  );
};

export default FileInput;
