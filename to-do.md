# vid2audio-webui To-Do

## Tooling & Setup

- [x] Bootstrap frontend with Create React App (TypeScript template)
- [x] Set up `ts-node` for backend development
- [x] Set up `tsc` for backend production builds
- [x] Configure ESLint and Prettier for linting and formatting
- [x] Set up Docker-only deployment

## Web UI

- [x] Implement drag-and-drop or file picker for video upload (Basic file picker added)
- [x] Add inline video preview player after upload
- [x] Implement start–end trim sliders with numeric time inputs
- [x] Display trim metadata (start, end, total duration, selected duration)
- [x] Add "Convert to MP3" button after trim selection
- [x] Implement real-time status messages (upload, queue position, conversion progress)
- [x] Display a visible queue list for multiple files (sequential processing)
- [x] Ensure responsive layout for mobile and desktop
- [x] Style the UI similar to vid2gif-webui (clean, dark-mode)
- [x] Add download button for completed jobs (Frontend only - Backend endpoint needed)

## Backend (Node.js + Express + TypeScript)

- [x] Set up Node.js + Express backend with TypeScript (strict mode)
- [x] Integrate `node-ffmpeg` for MP3 conversion and trimming (Trimming, queueing, & WS progress added)
- [x] Implement WebSocket for real-time updates
- [x] Dockerize the backend application
- [x] Add `/download/:jobId` endpoint to serve completed MP3 files

## Docker Development Workflow

- [x] Configure Docker containers with volume mounts for hot-reloading
- [x] Define `npm` scripts for starting the application (e.g., via `docker compose up`)
