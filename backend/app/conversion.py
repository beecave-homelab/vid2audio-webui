import os
import json
import redis
from datetime import datetime, timedelta
import ffmpeg
import asyncio
from .websocket import manager

# Load environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
FFMPEG_PATH = os.getenv("FFMPEG_PATH", "/usr/bin/ffmpeg")
FILE_RETENTION_HOURS = int(os.getenv("FILE_RETENTION_HOURS", 24))

# Initialize Redis client
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)

def add_conversion_job(job_data):
    """Add a new conversion job to the Redis queue."""
    file_id = job_data["file_id"]
    print(f"DEBUG: [add_conversion_job] Adding job {file_id} with data: {job_data}")
    
    # Store job data in Redis hash
    print(f"DEBUG: [add_conversion_job] Setting hash job:{file_id}")
    redis_client.hset(f"job:{file_id}", mapping={k: str(v) for k, v in job_data.items()})
    
    # Add job to conversion queue
    print(f"DEBUG: [add_conversion_job] Pushing job {file_id} to list conversion_queue")
    redis_client.lpush("conversion_queue", json.dumps({"file_id": file_id}))
    
    print(f"DEBUG: [add_conversion_job] Job {file_id} added.")
    return file_id

def get_job_status(file_id):
    """Get the status of a conversion job."""
    print(f"DEBUG: [get_job_status] Fetching status for job {file_id}")
    job_data = redis_client.hgetall(f"job:{file_id}")
    
    if not job_data:
        print(f"DEBUG: [get_job_status] Job {file_id} not found in Redis.")
        return None
    
    # Convert bytes to string for JSON response
    result = {k.decode('utf-8'): v.decode('utf-8') for k, v in job_data.items()}
    print(f"DEBUG: [get_job_status] Returning status for job {file_id}: {result}")
    return result

def update_job_status(file_id, status, progress=None, message=None):
    """Update the status of a conversion job."""
    updates = {"status": status}
    
    if progress is not None:
        updates["progress"] = str(progress)
    
    if message is not None:
        updates["message"] = message
    
    print(f"DEBUG: [update_job_status] Updating job {file_id} with: {updates}")
    redis_client.hset(f"job:{file_id}", mapping=updates)
    print(f"DEBUG: [update_job_status] Job {file_id} updated in Redis.")
    
    # Send WebSocket update if client_id matches file_id
    ws_data = {
        "file_id": file_id,
        "status": status,
        "progress": float(progress) if progress is not None else 0,
        "message": message
    }
    print(f"DEBUG: [update_job_status] Creating WebSocket task for job {file_id} with data: {ws_data}")
    asyncio.create_task(manager.send_progress(file_id, ws_data))

def delete_job(file_id):
    """Delete a job and its associated data."""
    print(f"DEBUG: [delete_job] Deleting job {file_id}")
    # Remove from scheduled deletion
    output_path = redis_client.hget(f"job:{file_id}", "output_path")
    if output_path:
        print(f"DEBUG: [delete_job] Removing {output_path.decode('utf-8')} from file_expiry for job {file_id}")
        redis_client.zrem("file_expiry", output_path.decode('utf-8'))
    else:
        print(f"DEBUG: [delete_job] No output_path found in job {file_id} to remove from file_expiry")
    
    # Delete the job data
    print(f"DEBUG: [delete_job] Deleting Redis hash job:{file_id}")
    deleted_count = redis_client.delete(f"job:{file_id}")
    print(f"DEBUG: [delete_job] Deleted Redis hash job:{file_id} (Count: {deleted_count})")

def schedule_file_deletion(file_path, delay_hours=FILE_RETENTION_HOURS):
    """Schedule a file for deletion after specified hours."""
    expiry_time = datetime.now() + timedelta(hours=delay_hours)
    print(f"DEBUG: [schedule_file_deletion] Scheduling {file_path} for deletion at {expiry_time} ({expiry_time.timestamp()})")
    redis_client.zadd("file_expiry", {file_path: expiry_time.timestamp()})

def convert_to_mp3(input_path, output_path, file_id):
    """Convert video to MP3 using FFmpeg with progress tracking."""
    print(f"INFO: [convert_to_mp3] Starting conversion for job {file_id}")
    print(f"DEBUG: [convert_to_mp3] Input: {input_path}, Output: {output_path}")
    try:
        # Get video duration for progress calculation
        print(f"DEBUG: [convert_to_mp3] Probing video duration for {input_path}")
        probe = ffmpeg.probe(input_path)
        duration = float(probe['format']['duration'])
        print(f"DEBUG: [convert_to_mp3] Video duration: {duration} seconds")
        
        # Update job status to processing
        update_job_status(file_id, "processing", 0, "Starting conversion")
        
        # Set up FFmpeg command with progress output
        print(f"DEBUG: [convert_to_mp3] Setting up FFmpeg command for job {file_id}")
        process = (
            ffmpeg
            .input(input_path)
            .output(output_path, format='mp3', audio_bitrate='192k', acodec='libmp3lame')
            .global_args('-progress', '-', '-nostats')
            .run_async(pipe_stdout=True, pipe_stderr=True)
        )
        print(f"DEBUG: [convert_to_mp3] FFmpeg process started for job {file_id} (PID: {process.pid})")
        
        # Process FFmpeg output for progress updates
        print(f"DEBUG: [convert_to_mp3] Reading FFmpeg stdout for progress (Job: {file_id})")
        while True:
            line = process.stdout.readline().decode('utf-8', errors='ignore').strip()
            if not line:
                break
                
            # Parse progress information
            if line.startswith('out_time_ms='):
                try:
                    time_ms = int(line.split('=')[1])
                    progress = min(100, (time_ms / 1000000) / duration * 100)
                    update_job_status(file_id, "processing", progress, f"Converting: {progress:.1f}%")
                except (ValueError, ZeroDivisionError) as parse_err:
                    print(f"WARNING: [convert_to_mp3] Failed to parse progress line '{line}': {parse_err}")
        
        print(f"DEBUG: [convert_to_mp3] Finished reading FFmpeg stdout for job {file_id}")
        
        # Wait for process to complete
        print(f"DEBUG: [convert_to_mp3] Waiting for FFmpeg process to complete (Job: {file_id})")
        return_code = process.wait()
        print(f"DEBUG: [convert_to_mp3] FFmpeg process finished with return code {return_code} (Job: {file_id})")
        
        stderr_output = process.stderr.read().decode('utf-8', errors='ignore')
        if return_code != 0:
            print(f"WARNING: [convert_to_mp3] FFmpeg stderr output (Job {file_id}):\n{stderr_output}")
        
        # Check if conversion was successful
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0 and return_code == 0:
            print(f"INFO: [convert_to_mp3] Conversion successful for job {file_id}")
            update_job_status(file_id, "completed", 100, "Conversion completed")
            return True
        else:
            error_message = f"Conversion failed: Output file missing or empty, or FFmpeg error (Code: {return_code})"
            print(f"ERROR: [convert_to_mp3] {error_message} (Job: {file_id})")
            update_job_status(file_id, "failed", 0, error_message)
            return False
            
    except ffmpeg.Error as e:
        stderr = e.stderr.decode('utf-8', errors='ignore') if e.stderr else 'N/A'
        error_message = f"ffmpeg.Error during conversion: {str(e)}\nStderr: {stderr}"
        print(f"ERROR: [convert_to_mp3] {error_message} (Job: {file_id})")
        update_job_status(file_id, "failed", 0, f"Conversion failed: {str(e)}")
        return False
    except Exception as e:
        import traceback
        error_message = f"Unexpected error during conversion: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR: [convert_to_mp3] {error_message} (Job: {file_id})")
        update_job_status(file_id, "failed", 0, f"Conversion failed: {str(e)}")
        return False
