import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

// Mock the WebSocket
jest.mock('../hooks/useWebSocket', () => {
  return () => ({
    isConnected: true,
    lastMessage: null,
    error: null,
    sendMessage: jest.fn(),
  });
});

// Mock XMLHttpRequest
global.XMLHttpRequest = jest.fn(() => ({
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  upload: {
    addEventListener: jest.fn(),
  },
  addEventListener: jest.fn((event, handler) => {
    if (event === 'load') {
      // Simulate successful response
      setTimeout(() => {
        handler({
          target: {
            status: 200,
            responseText: JSON.stringify({
              file_id: 'test-file-id',
              status: 'queued',
              message: 'File uploaded successfully and queued for conversion'
            })
          }
        });
      }, 100);
    }
  }),
}));

describe('App Component', () => {
  test('renders the header', () => {
    render(<App />);
    const headerElement = screen.getByText(/Video to MP3 Converter/i);
    expect(headerElement).toBeInTheDocument();
  });

  test('renders the dropzone', () => {
    render(<App />);
    const dropzoneElement = screen.getByText(/Drag & drop a video file here/i);
    expect(dropzoneElement).toBeInTheDocument();
  });

  test('shows supported formats', () => {
    render(<App />);
    const formatsElement = screen.getByText(/Supported formats/i);
    expect(formatsElement).toBeInTheDocument();
  });

  test('handles file upload', async () => {
    render(<App />);
    
    // Create a mock file
    const file = new File(['dummy content'], 'test.mp4', { type: 'video/mp4' });
    
    // Get the dropzone element
    const dropzone = screen.getByText(/Drag & drop a video file here/i).closest('div');
    
    // Simulate file drop
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
        items: [
          {
            kind: 'file',
            type: file.type,
            getAsFile: () => file
          }
        ],
        types: ['Files']
      }
    });
    
    // Wait for the file info to appear
    await waitFor(() => {
      expect(screen.getByText(/File: test.mp4/i)).toBeInTheDocument();
    });
  });
});
