import pytest
from fastapi.testclient import TestClient
from ..main import app
import os
import tempfile
import shutil

client = TestClient(app)

# Create a test video file
def create_test_video():
    # Create a temporary file that simulates a small video file
    temp_file = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    temp_file.write(b"test video content")
    temp_file.close()
    return temp_file.name

def test_root_endpoint():
    response = client.get("/api/")
    assert response.status_code == 200
    assert "message" in response.json()

def test_upload_invalid_format():
    # Test with invalid file format
    temp_file = tempfile.NamedTemporaryFile(suffix=".txt", delete=False)
    temp_file.write(b"not a video file")
    temp_file.close()
    
    try:
        with open(temp_file.name, "rb") as f:
            response = client.post(
                "/api/upload/",
                files={"file": ("test.txt", f, "text/plain")}
            )
        assert response.status_code == 400
        assert "Invalid video format" in response.json()["detail"]
    finally:
        os.unlink(temp_file.name)

def test_upload_valid_format():
    # Test with valid file format
    video_path = create_test_video()
    
    try:
        with open(video_path, "rb") as f:
            response = client.post(
                "/api/upload/",
                files={"file": ("test.mp4", f, "video/mp4")}
            )
        assert response.status_code == 200
        assert "file_id" in response.json()
        assert response.json()["status"] == "queued"
    finally:
        os.unlink(video_path)

def test_status_nonexistent_job():
    response = client.get("/api/status/nonexistent-id")
    assert response.status_code == 404

def test_download_nonexistent_file():
    response = client.get("/api/download/nonexistent-id")
    assert response.status_code == 404
