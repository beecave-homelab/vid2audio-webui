// Type for queue jobs received from backend
export interface QueueJob {
  id: string;
  filename: string;
  status: 'uploading' | 'uploaded' | 'processing' | 'complete' | 'error';
  uploadProgress: number;
  conversionProgress: number;
}
