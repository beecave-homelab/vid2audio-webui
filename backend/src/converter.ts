import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

// Define options for conversion, including trimming
export interface ConversionOptions {
  startTime?: number; // Start time in seconds
  endTime?: number;   // End time in seconds
}

// Define progress callback type
export type ProgressCallback = (progress: { percent: number; /* Add other fields if needed */ }) => void;

// Function to convert video to MP3 with optional trimming and progress reporting
export const convertVideoToMp3 = (
  inputPath: string, 
  options: ConversionOptions = {},
  onProgress?: ProgressCallback // Add optional progress callback
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Resolve path relative to the project root (backend/)
    const outputDir = path.resolve(__dirname, '..', 'outputs'); 
    const inputFilename = path.basename(inputPath, path.extname(inputPath));
    // Ensure output dir exists (though index.ts should also handle this)
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Sanitize filename part derived from timings to avoid filesystem issues
    const startTag = options.startTime !== undefined ? options.startTime.toFixed(2).replace('.', '_') : 'start';
    const endTag = options.endTime !== undefined ? options.endTime.toFixed(2).replace('.', '_') : 'end';

    const outputFileName = `${inputFilename}_${startTag}-${endTag}.mp3`;
    const outputPath = path.join(outputDir, outputFileName);

    const command = ffmpeg(inputPath);

    // Apply trimming if start or end time is provided
    if (options.startTime !== undefined) {
      command.setStartTime(options.startTime);
    }
    if (options.endTime !== undefined && options.startTime !== undefined) {
      // fluent-ffmpeg uses duration, so calculate it
      const duration = options.endTime - options.startTime;
      if (duration > 0) {
        command.setDuration(duration);
      } else {
        // Handle invalid end time (e.g., end <= start)
        console.warn('Invalid end time provided for trimming, ignoring duration.');
      }
    } else if (options.endTime !== undefined) {
        // If only end time is specified, treat it as duration from the start
        console.warn('Only end time provided, treating as duration. Provide startTime for accurate trimming.');
        command.setDuration(options.endTime);
    }

    command
      .output(outputPath)
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .on('progress', (progress) => {
        // fluent-ffmpeg provides progress data (often includes timemark, percent, etc.)
        if (onProgress && progress.percent) {
          // Send percentage progress
          onProgress({ percent: progress.percent });
        }
      })
      .on('end', () => {
        console.log(`Conversion finished: ${outputPath}`);
        // TODO: Optionally delete original file?
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`Error during conversion: ${err.message}`);
        reject(err);
      })
      .run();
  });
}; 