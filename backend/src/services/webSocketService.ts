import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';
import { IncomingMessage } from 'http';
import net from 'net';

// Define the path for application WebSocket connections
const wsPath = '/app-ws';

// Store connected clients
const clients = new Set<WebSocket>();

// Function to initialize WebSocket server
export const initializeWebSocket = (app: express.Express) => {
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // WebSocket connection handler
  wss.on('connection', (ws: WebSocket) => {
    console.log('[WebSocket]: Client connected');
    clients.add(ws);

    ws.on('message', (message: Buffer) => {
      console.log('[WebSocket]: Received:', message.toString());
      ws.send(`Server received: ${message.toString()}`);
    });

    ws.on('close', () => {
      console.log('[WebSocket]: Client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error: any) => {
      console.error('[WebSocket]: Error:', error);
      clients.delete(ws);
    });

    // Send a welcome message
    ws.send(JSON.stringify({ type: 'connection', message: 'Connected to Vid2Audio WebSocket' }));
  });

  // Handle server upgrade requests specifically for the WebSocket path
  server.on('upgrade', (request: IncomingMessage, socket: net.Socket, head: any) => {
    const pathname = request.url;
    if (pathname === wsPath) {
      wss.handleUpgrade(request, socket, head, (ws: any) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  return server;
};

// Function to broadcast messages to all connected clients
export const broadcast = (message: any) => {
  const messageString = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageString);
    }
  });
}; 