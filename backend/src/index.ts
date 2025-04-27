import express, { Express } from 'express';
import { initializeWebSocket } from './services/webSocketService';
import { setupDirectories } from './utils/setup';
import uploadRouter from './routes/upload';
import downloadRouter from './routes/download';
import statusRouter from './routes/status';

const app: Express = express();

// Setup directories
setupDirectories();

// Initialize WebSocket server
const server = initializeWebSocket(app);

const port = process.env.PORT || 3001;

// Setup routes
app.get('/', (req, res) => {
  res.send('Vid2Audio Backend API');
});

app.use('/upload', uploadRouter);
app.use('/download', downloadRouter);
app.use('/queue-status', statusRouter);

// Start the server
server.listen(port, () => {
  console.log(`[server]: Server (HTTP + WebSocket) is running at http://localhost:${port}`);
}); 