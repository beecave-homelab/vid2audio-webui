import os
import uuid
import shutil
import aiofiles
import redis
import json
from datetime import datetime, timedelta
import asyncio
import logging

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configuration
PORT = int(os.getenv("PORT", 8000))
FFMPEG_PATH = os.getenv("FFMPEG_PATH", "/usr/bin/ffmpeg")
STORAGE_PATH = os.getenv("STORAGE_PATH", "/tmp/uploads")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 2147483648))  # 2GB default
FILE_RETENTION_HOURS = int(os.getenv("FILE_RETENTION_HOURS", 24))
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))

# Create storage directory if it doesn't exist
logger.info(f"Ensuring storage path exists: {STORAGE_PATH}")
os.makedirs(STORAGE_PATH, exist_ok=True)

# Initialize FastAPI app
app = FastAPI(
    title="Video to MP3 Converter",
    description="Convert video files to MP3 audio format",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Redis client
logger.info(f"Connecting to Redis at {REDIS_HOST}:{REDIS_PORT}")
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"WebSocket connected: {client_id} (Total: {len(self.active_connections)})")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"WebSocket disconnected: {client_id} (Total: {len(self.active_connections)})")
        else:
            logger.warning(f"Attempted to disconnect WebSocket for unknown client_id: {client_id}")

    async def send_progress(self, client_id: str, data: dict):
        if client_id in self.active_connections:
            logger.debug(f"Sending WebSocket progress to {client_id}: {data}")
            await self.active_connections[client_id].send_json(data)
        else:
            logger.warning(f"Attempted to send WebSocket progress to unknown client_id: {client_id}")

manager = ConnectionManager()

# Helper functions
def is_valid_video_format(filename):
    """Check if the file has a valid video extension."""
    valid_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v']
    return any(filename.lower().endswith(ext) for ext in valid_extensions)

def get_file_path(file_id, extension):
    """Generate file path based on ID and extension."""
    return os.path.join(STORAGE_PATH, f"{file_id}{extension}")

def get_output_path(file_id):
    """Generate output MP3 path based on ID."""
    return os.path.join(STORAGE_PATH, f"{file_id}.mp3")

def schedule_file_deletion(file_path, delay_hours=FILE_RETENTION_HOURS):
    """Schedule a file for deletion after specified hours."""
    expiry_time = datetime.now() + timedelta(hours=delay_hours)
    redis_client.zadd("file_expiry", {file_path: expiry_time.timestamp()})

# Create API router
api_router = APIRouter()

# API endpoints moved to router
@app.get("/")
async def root():
    logger.info("Root endpoint / accessed")
    return {"message": "Video to MP3 Converter API"}

@api_router.post("/upload/")
async def upload_video(file: UploadFile = File(...)):
    """Upload a video file for conversion."""
    logger.info(f"Upload request received for file: {file.filename}")
    if not is_valid_video_format(file.filename):
        logger.warning(f"Upload failed: Invalid video format for {file.filename}")
        raise HTTPException(status_code=400, detail="Invalid video format")
    
    # Generate unique ID for this conversion
    file_id = str(uuid.uuid4())
    logger.info(f"Generated file_id {file_id} for {file.filename}")
    
    # Get file extension
    _, ext = os.path.splitext(file.filename)
    
    # Create file paths
    input_path = get_file_path(file_id, ext)
    output_path = get_output_path(file_id)
    
    # Save uploaded file
    try:
        logger.info(f"Saving uploaded file {file.filename} to {input_path}")
        async with aiofiles.open(input_path, 'wb') as out_file:
            # Read and write in chunks to handle large files
            while content := await file.read(1024 * 1024):  # 1MB chunks
                await out_file.write(content)
        logger.info(f"Successfully saved file {file.filename} to {input_path}")
    except Exception as e:
        logger.error(f"Failed to save file {file.filename} to {input_path}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Add conversion job to Redis queue
    job_data = {
        "file_id": file_id,
        "input_path": input_path,
        "output_path": output_path,
        "original_filename": file.filename,
        "status": "queued",
        "created_at": datetime.now().isoformat(),
    }
    
    logger.info(f"Adding job {file_id} to Redis queue")
    # Push only the file_id to the queue, worker fetches details via hash
    redis_client.lpush("conversion_queue", json.dumps({"file_id": file_id}))
    # Store full job details in the hash
    redis_client.hset(f"job:{file_id}", mapping=job_data)
    
    # Schedule file deletion
    logger.info(f"Scheduling deletion for {input_path} and {output_path} (Job: {file_id})")
    schedule_file_deletion(input_path)
    schedule_file_deletion(output_path)
    
    logger.info(f"Upload successful for job {file_id}, returning response.")
    return {
        "file_id": file_id,
        "status": "queued",
        "message": "File uploaded successfully and queued for conversion"
    }

@api_router.get("/status/{file_id}")
async def get_conversion_status(file_id: str):
    """Get the status of a conversion job."""
    logger.info(f"Status request received for job {file_id}")
    job_data = redis_client.hgetall(f"job:{file_id}")
    
    if not job_data:
        logger.warning(f"Status request failed: Job {file_id} not found")
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Convert bytes to string for JSON response
    result = {k.decode('utf-8'): v.decode('utf-8') for k, v in job_data.items()}
    logger.info(f"Returning status for job {file_id}: {result}")
    return result

@api_router.get("/download/{file_id}")
async def download_mp3(file_id: str, background_tasks: BackgroundTasks):
    """Download the converted MP3 file."""
    logger.info(f"Download request received for job {file_id}")
    output_path = get_output_path(file_id)
    
    # Check if file exists
    if not os.path.exists(output_path):
        logger.warning(f"Download failed: Output file not found for job {file_id} at {output_path}")
        raise HTTPException(status_code=404, detail="File not found or conversion not completed")
    
    # Get original filename from Redis
    job_data = redis_client.hgetall(f"job:{file_id}")
    if not job_data:
        logger.warning(f"Download failed: Job info not found for job {file_id}")
        raise HTTPException(status_code=404, detail="Job information not found")
    
    original_filename = job_data.get(b"original_filename", b"download").decode('utf-8')
    filename_base = os.path.splitext(original_filename)[0]
    download_filename = f"{filename_base}.mp3"
    
    # Schedule file for deletion after download
    def delete_after_download():
        try:
            logger.info(f"Performing background deletion for job {file_id}, file {output_path}")
            # Remove from scheduled deletion
            redis_client.zrem("file_expiry", output_path)
            # Delete the file immediately
            if os.path.exists(output_path):
                os.remove(output_path)
                logger.info(f"Deleted file {output_path} after download (Job: {file_id})")
            # Delete the job data
            redis_client.delete(f"job:{file_id}")
            logger.info(f"Deleted Redis job data for job {file_id}")
        except Exception as e:
            logger.error(f"Error during background deletion for job {file_id}: {e}", exc_info=True)
    
    background_tasks.add_task(delete_after_download)
    logger.info(f"Sending file {output_path} for download (Job: {file_id})")
    return FileResponse(
        path=output_path,
        filename=download_filename,
        media_type="audio/mpeg"
    )

# WebSocket endpoint remains on the main app
@api_router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time conversion progress updates."""
    logger.info(f"WebSocket connection attempt from client_id: {client_id}")
    await manager.connect(websocket, client_id)
    try:
        while True:
            # Keep connection alive by waiting for messages (optional)
            data = await websocket.receive_text() # Or receive_bytes, receive_json
            logger.debug(f"Received keep-alive message from WebSocket {client_id}: {data}")
    except WebSocketDisconnect:
        logger.info(f"WebSocket client {client_id} initiated disconnect.")
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}", exc_info=True)
        manager.disconnect(client_id) # Ensure disconnection on error

# Include the API router with the /api prefix
app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    logger.info(f"Starting Uvicorn server on 0.0.0.0:{PORT}")
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
