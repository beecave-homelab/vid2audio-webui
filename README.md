# Video to MP3 Converter

A web-based platform for converting uploaded videos into MP3 audio files using FFmpeg, with real-time progress tracking and downloads.

## Features

- Upload video files up to 2GB in size
- Support for common video formats (MP4, AVI, MOV, MKV, WMV, FLV, WEBM, M4V)
- Real-time conversion progress tracking via WebSockets
- Dark-themed responsive UI with drag-and-drop upload
- Automatic file cleanup (after download or after 24 hours)
- Queue-based processing with Redis

## Architecture

The application consists of four main components:

1. **Frontend**: React-based UI with drag-and-drop upload and real-time progress tracking
2. **Backend API**: FastAPI application handling file uploads, status checks, and downloads
3. **Worker**: Background process for video-to-MP3 conversion using FFmpeg
4. **Redis**: Queue system for managing conversion jobs

## Prerequisites

- Docker and Docker Compose
- 2GB+ of free disk space for file processing

## Installation

### Using Docker (Recommended)

1. Clone the repository:
   ```
   git clone https://github.com/beecave-homelab/vid2audio-webui.git
   cd vid2audio-webui
   ```

2. Start the application using Docker Compose:
   ```
   docker-compose up -d
   ```

3. Access the application at http://localhost:3000

### Manual Installation

#### Backend Setup

1. Install Python 3.10+ and FFmpeg:
   ```
   sudo apt update
   sudo apt install python3 python3-pip ffmpeg redis-server
   ```

2. Create a virtual environment and install dependencies:
   ```
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. Start the Redis server:
   ```
   sudo systemctl start redis-server
   ```

4. Start the FastAPI application:
   ```
   cd backend
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

5. Start the worker process in a separate terminal:
   ```
   cd backend
   python worker/worker.py
   ```

#### Frontend Setup

1. Install Node.js and npm:
   ```
   sudo apt install nodejs npm
   ```

2. Install dependencies and start the development server:
   ```
   cd frontend
   npm install
   npm start
   ```

3. Access the application at http://localhost:3000

## API Reference

### Upload Endpoint

- **URL**: `/api/upload/`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Parameters**: `file` (video file)
- **Response**:
  ```json
  {
    "file_id": "uuid-string",
    "status": "queued",
    "message": "File uploaded successfully and queued for conversion"
  }
  ```

### Status Endpoint

- **URL**: `/api/status/{file_id}`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "file_id": "uuid-string",
    "status": "processing|completed|failed",
    "progress": 45.5,
    "message": "Converting: 45.5%"
  }
  ```

### Download Endpoint

- **URL**: `/api/download/{file_id}`
- **Method**: `GET`
- **Response**: MP3 file download

### WebSocket Endpoint

- **URL**: `/api/ws/{client_id}`
- **Protocol**: WebSocket
- **Messages**:
  ```json
  {
    "file_id": "uuid-string",
    "status": "processing|completed|failed",
    "progress": 45.5,
    "message": "Converting: 45.5%"
  }
  ```

## Configuration

The application can be configured using environment variables in the `.env` file:

- `PORT`: Backend server port (default: 8000)
- `FFMPEG_PATH`: Path to FFmpeg executable (default: /usr/bin/ffmpeg)
- `STORAGE_PATH`: Path for temporary file storage (default: /tmp/uploads)
- `MAX_FILE_SIZE`: Maximum file size in bytes (default: 2147483648 - 2GB)
- `FILE_RETENTION_HOURS`: Hours to keep files before deletion (default: 24)
- `REDIS_HOST`: Redis server hostname (default: localhost or redis in Docker)
- `REDIS_PORT`: Redis server port (default: 6379)

## Project Structure

```
video-to-mp3/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── routes.py
│   │   ├── services/
│   │   │   ├── conversion.py
│   │   │   └── websocket.py
│   │   ├── models/
│   │   │   └── schemas.py
│   │   ├── __init__.py
│   │   └── main.py
│   ├── worker/
│   │   └── worker.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dropzone.js
│   │   │   ├── FileConversion.js
│   │   │   └── ProgressBar.js
│   │   ├── hooks/
│   │   │   └── useWebSocket.js
│   │   ├── styles/
│   │   │   ├── App.css
│   │   │   └── index.css
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   ├── nginx.conf
│   └── Dockerfile
│
├── docker-compose.yml
├── .env
└── README.md
```

## Development

### Backend Development

The backend is built with FastAPI and follows a modular structure:
- `app/api/routes.py`: API endpoints for upload, status, download, and WebSocket
- `app/services/conversion.py`: FFmpeg integration and conversion logic
- `app/services/websocket.py`: WebSocket connection management
- `app/models/schemas.py`: Pydantic models for request/response validation
- `worker/worker.py`: Background worker for processing the conversion queue

### Frontend Development

The frontend is built with React and includes:
- Drag-and-drop file upload using react-dropzone
- Real-time progress tracking with WebSockets
- Responsive design for mobile and desktop
- Dark theme UI

## Troubleshooting

### Common Issues

1. **Upload fails with 413 error**:
   - Check if the file size exceeds the 2GB limit
   - Ensure your web server is configured to allow large file uploads

2. **Conversion gets stuck**:
   - Check if FFmpeg is properly installed
   - Verify Redis is running and accessible
   - Check worker logs for errors

3. **WebSocket connection fails**:
   - Ensure your network allows WebSocket connections
   - Check if the backend server is running and accessible

## License

This project is licensed under the MIT License - see the LICENSE file for details.
