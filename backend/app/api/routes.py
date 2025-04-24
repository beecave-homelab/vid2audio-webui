from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
import os
import uuid
import aiofiles
import json
from datetime import datetime
import asyncio
from ..conversion import add_conversion_job, get_job_status, schedule_file_deletion
from ..websocket import manager
from ..schemas import ConversionResponse, StatusResponse

router = APIRouter()

# Helper functions
def is_valid_video_format(filename):
    """Check if the file has a valid video extension."""
    valid_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v']
    return any(filename.lower().endswith(ext) for ext in valid_extensions)

def get_file_path(file_id, extension):
    """Generate file path based on ID and extension."""
    storage_path = os.getenv("STORAGE_PATH", "/tmp/uploads")
    return os.path.join(storage_path, f"{file_id}{extension}")

def get_output_path(file_id):
    """Generate output MP3 path based on ID."""
    storage_path = os.getenv("STORAGE_PATH", "/tmp/uploads")
    return os.path.join(storage_path, f"{file_id}.mp3")

# API endpoints
@router.get("/")
async def root():
    return {"message": "Video to MP3 Converter API"}

@router.post("/upload/", response_model=ConversionResponse)
async def upload_video(file: UploadFile = File(...)):
    """Upload a video file for conversion."""
    # Validate file format
    if not is_valid_video_format(file.filename):
        raise HTTPException(status_code=400, detail="Invalid video format")
    
    # Generate unique ID for this conversion
    file_id = str(uuid.uuid4())
    
    # Get file extension
    _, ext = os.path.splitext(file.filename)
    
    # Create file paths
    input_path = get_file_path(file_id, ext)
    output_path = get_output_path(file_id)
    
    # Create storage directory if it doesn't exist
    os.makedirs(os.path.dirname(input_path), exist_ok=True)
    
    # Save uploaded file
    try:
        async with aiofiles.open(input_path, 'wb') as out_file:
            # Read and write in chunks to handle large files
            while content := await file.read(1024 * 1024):  # 1MB chunks
                await out_file.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Add conversion job to Redis queue
    job_data = {
        "file_id": file_id,
        "input_path": input_path,
        "output_path": output_path,
        "original_filename": file.filename,
        "status": "queued",
        "created_at": datetime.now().isoformat(),
        "progress": 0
    }
    
    add_conversion_job(job_data)
    
    # Schedule file deletion
    schedule_file_deletion(input_path)
    schedule_file_deletion(output_path)
    
    return {
        "file_id": file_id,
        "status": "queued",
        "message": "File uploaded successfully and queued for conversion"
    }

@router.get("/status/{file_id}", response_model=StatusResponse)
async def get_conversion_status(file_id: str):
    """Get the status of a conversion job."""
    job_data = get_job_status(file_id)
    
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job_data

@router.get("/download/{file_id}")
async def download_mp3(file_id: str, background_tasks: BackgroundTasks):
    """Download the converted MP3 file."""
    output_path = get_output_path(file_id)
    
    # Check if file exists
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="File not found or conversion not completed")
    
    # Get original filename from Redis
    job_data = get_job_status(file_id)
    if not job_data:
        raise HTTPException(status_code=404, detail="Job information not found")
    
    original_filename = job_data.get("original_filename", "download")
    filename_base = os.path.splitext(original_filename)[0]
    download_filename = f"{filename_base}.mp3"
    
    # Schedule file for deletion after download
    def delete_after_download():
        try:
            # Delete the file immediately after download
            if os.path.exists(output_path):
                os.remove(output_path)
            # Delete the job data
            from ..conversion import delete_job
            delete_job(file_id)
        except Exception as e:
            print(f"Error deleting file: {str(e)}")
    
    background_tasks.add_task(delete_after_download)
    
    return FileResponse(
        path=output_path,
        filename=download_filename,
        media_type="audio/mpeg"
    )

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time conversion progress updates."""
    await manager.connect(websocket, client_id)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(client_id)
