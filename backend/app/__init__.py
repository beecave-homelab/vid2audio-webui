from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from .api.routes import router

# Load environment variables
load_dotenv()

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

# Include API routes
app.include_router(router, prefix="/api")

# Create storage directory if it doesn't exist
storage_path = os.getenv("STORAGE_PATH", "/tmp/uploads")
os.makedirs(storage_path, exist_ok=True)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
