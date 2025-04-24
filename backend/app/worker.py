import os
import time
import json
import redis
from datetime import datetime
import asyncio
from .conversion import get_job_status, update_job_status, convert_to_mp3

# Load environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
STORAGE_PATH = os.getenv("STORAGE_PATH", "/tmp/uploads")

# Initialize Redis client
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)

async def process_conversion_queue():
    """Worker process that monitors the conversion queue and processes jobs."""
    print("INFO: Starting conversion worker...")
    
    while True:
        try:
            # Check for expired files and delete them
            # print("DEBUG: Checking for expired files...")
            await cleanup_expired_files()
            
            # Get the next job from the queue
            print("INFO: Waiting for job on 'conversion_queue'...")
            job_data = redis_client.brpop("conversion_queue", timeout=5) # Increased timeout slightly
            
            if job_data:
                print(f"DEBUG: Received raw job data: {job_data}")
                # Extract job information
                _, job_json = job_data
                job = json.loads(job_json)
                file_id = job["file_id"]
                print(f"INFO: Received job ID: {file_id}")
                
                # Get full job details
                print(f"DEBUG: Fetching full job details for {file_id} from Redis")
                job_details = get_job_status(file_id)
                print(f"DEBUG: Fetched job details: {job_details}")
                
                if job_details and job_details.get("status") == "queued":
                    print(f"INFO: Processing job {file_id}")
                    
                    # Update job status to 'processing'
                    print(f"DEBUG: Updating job {file_id} status to 'processing'")
                    update_job_status(file_id, status="processing", progress=0)
                    print(f"DEBUG: Job {file_id} status updated to 'processing'")
                    
                    input_path = job_details.get("input_path")
                    output_path = job_details.get("output_path")
                    print(f"DEBUG: Job {file_id} - Input: {input_path}, Output: {output_path}")
                    
                    # Perform the conversion
                    print(f"INFO: Starting conversion for job {file_id}")
                    success = convert_to_mp3(input_path, output_path, file_id)
                    print(f"INFO: Conversion finished for job {file_id}. Success: {success}")
                    
                    # Clean up input file after successful conversion
                    if success and os.path.exists(input_path):
                        print(f"INFO: Cleaning up input file: {input_path} (Job: {file_id})")
                        os.remove(input_path)
                        print(f"INFO: Input file {input_path} deleted.")
                    elif not success:
                        print(f"WARNING: Conversion failed for job {file_id}. Input file {input_path} not deleted.")
                elif not job_details:
                    print(f"WARNING: Could not retrieve details for job {file_id} from Redis hash. Skipping.")
                else:
                    print(f"WARNING: Job {file_id} has unexpected status '{job_details.get('status')}'. Skipping.")
            
            else:
                # No jobs in queue, loop continues
                # print("DEBUG: No job received, looping.")
                pass # No need to sleep here, brpop handles waiting
                
        except json.JSONDecodeError as e:
            print(f"ERROR: Failed to decode JSON job data: {job_data}. Error: {e}")
            # Potentially push back to queue or move to dead-letter queue
        except Exception as e:
            print(f"ERROR: Unhandled exception in worker process: {str(e)}")
            import traceback
            traceback.print_exc()
            await asyncio.sleep(5)  # Wait before retrying

async def cleanup_expired_files():
    """Delete files that have passed their expiration time."""
    current_time = datetime.now().timestamp()
    # print(f"DEBUG: Cleaning files expired before {current_time}")
    
    # Get expired files
    expired_files = redis_client.zrangebyscore("file_expiry", 0, current_time)
    # print(f"DEBUG: Found {len(expired_files)} expired file records.")
    
    for file_path_bytes in expired_files:
        path = file_path_bytes.decode('utf-8')
        try:
            if os.path.exists(path):
                print(f"INFO: Deleting expired file: {path}")
                os.remove(path)
                print(f"INFO: Deleted expired file successfully: {path}")
            else:
                print(f"WARNING: Expired file path not found, removing record anyway: {path}")
            
            # Remove from expiry set
            redis_client.zrem("file_expiry", path)
        except Exception as e:
            print(f"ERROR: Failed during deletion of expired file {path}: {str(e)}")

def run_worker():
    """Run the worker process."""
    print("INFO: Worker starting asyncio event loop.")
    asyncio.run(process_conversion_queue())

if __name__ == "__main__":
    print("INFO: worker.py executed directly.")
    run_worker()
