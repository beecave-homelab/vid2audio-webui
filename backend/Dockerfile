# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies (including ffmpeg)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Create storage directory and set permissions (adjust permissions as needed)
# This path matches the default STORAGE_PATH in main.py
RUN mkdir -p /tmp/uploads 
# Optionally, set ownership if running as non-root user:
# RUN chown -R www-data:www-data /tmp/uploads

# Install Python dependencies
# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code from the host's backend directory into the container's /app directory
COPY ./app/ ./

# Make port 8000 available to the world outside this container
# Default port from main.py, can be overridden by PORT env var
EXPOSE 8000

# Define environment variable for the storage path within the container
ENV STORAGE_PATH=/tmp/uploads
# Define environment variable for ffmpeg path within the container
ENV FFMPEG_PATH=/usr/bin/ffmpeg

# Run the application using uvicorn
# Use 0.0.0.0 to allow connections from outside the container
# Workers can be adjusted based on CPU cores
# The command needs to refer to the app instance within the main module inside the app directory
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
