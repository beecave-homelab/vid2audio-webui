from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class ConversionResponse(BaseModel):
    """Response model for conversion job creation"""
    file_id: str
    status: str
    message: str


class StatusResponse(BaseModel):
    """Response model for job status"""
    file_id: str
    status: str
    original_filename: str
    created_at: str
    progress: Optional[float] = 0
    message: Optional[str] = None


class WebSocketMessage(BaseModel):
    """WebSocket message model"""
    file_id: str
    status: str
    progress: float
    message: Optional[str] = None
