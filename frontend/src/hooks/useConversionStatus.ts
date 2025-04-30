import { useState, useEffect, useRef, useCallback } from 'react';
import { QueueJob } from '../utils/types';

export function useConversionStatus() {
  const [queue, setQueue] = useState<QueueJob[]>([]);
  const ws = useRef<WebSocket | null>(null);

  // Function to fetch queue status from backend (used for polling)
  const fetchQueueStatus = useCallback(async () => {
    try {
      const response = await fetch('/queue-status');
      if (response.ok) {
        const data = await response.json();
        console.log('[Polling]: Received queue data:', data.queue);
        setQueue(data.queue);
      } else {
        console.error('[Polling]: Failed to fetch queue status:', response.statusText);
      }
    } catch (error) {
      console.error('[Polling]: Error fetching queue status:', error);
    }
  }, []);

  // Effect to setup WebSocket connection and polling fallback
  useEffect(() => {
    // Variable to hold the WebSocket instance for this effect run
    let socket: WebSocket | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let initialConnectionTimeout: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      // Determine WebSocket URL (ws:// or wss://)
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Connect directly to the backend service, bypassing proxy for testing
      const wsUrl = `${wsProto}//192.168.2.95:3001/app-ws`;
      console.log('(Effect Run) Connecting WebSocket directly to:', wsUrl);
      socket = new WebSocket(wsUrl); // Assign to local variable for cleanup

      // Start polling as a fallback if WebSocket doesn't connect within a timeout
      initialConnectionTimeout = setTimeout(() => {
        if (socket && socket.readyState !== WebSocket.OPEN) {
          console.log('WebSocket did not connect in time, starting polling fallback.');
          // Clear existing interval if any before starting new one
          if (pollingInterval) clearInterval(pollingInterval);
          pollingInterval = setInterval(fetchQueueStatus, 5000);
        }
      }, 10000); // Wait 10 seconds

      socket.onopen = () => {
        console.log('WebSocket Connected');
        ws.current = socket; // Assign to ref only when open
        // Stop polling if it was started
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
          console.log('WebSocket connected, stopping polling fallback.');
        }
        // Clear connection timeout
        if (initialConnectionTimeout) clearTimeout(initialConnectionTimeout);
      };

      socket.onclose = () => {
        console.log('WebSocket Disconnected');
        // Clear the ref if it currently holds this specific socket instance
        if (ws.current === socket) {
          ws.current = null;
        }
        // Start polling as fallback if not already polling
        if (!pollingInterval) {
          console.log('Starting polling fallback due to WebSocket disconnection.');
          pollingInterval = setInterval(fetchQueueStatus, 5000);
        }
        // Attempt to reconnect after a delay
        // Clear previous reconnect timeout if it exists
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
          if (!ws.current) {
            // Check ref again before reconnecting
            console.log('Attempting WebSocket reconnection...');
            connectWebSocket(); // Re-run the connection logic
          }
        }, 5000); // Wait 5 seconds
      };

      socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
        // Clear the ref if it currently holds this specific socket instance
        if (ws.current === socket) {
          ws.current = null;
        }
        // Start polling as fallback if not already polling
        if (!pollingInterval) {
          console.log('Starting polling fallback due to WebSocket error.');
          pollingInterval = setInterval(fetchQueueStatus, 5000);
        }
        // Attempt to reconnect after a delay (similar to onclose)
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
          if (!ws.current) {
            console.log('Attempting WebSocket reconnection after error...');
            connectWebSocket();
          }
        }, 5000);
      };

      socket.onmessage = (event) => {
        console.log('Debug: Raw WebSocket message received:', event.data);
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket Message Received:', data);

          switch (data.type) {
            case 'queue_update':
              console.log('[WebSocket][queue_update]: Updating state with new queue:', data.queue);
              setQueue(data.queue);
              break;
            case 'connection':
              console.log('[WebSocket][connection]: Connection established with server:', data.message);
              break;
            // Handle other message types if needed (job_progress, job_complete, etc.)
            default:
              console.log('Unknown or unhandled message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    };

    if (!ws.current) {
      connectWebSocket();
    }

    // Cleanup function
    return () => {
      // Clear timeouts
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (initialConnectionTimeout) clearTimeout(initialConnectionTimeout);

      // Use the local `socket` variable captured by this effect's closure
      if (socket) {
        console.log(`(Cleanup) Checking WebSocket state (readyState: ${socket.readyState})`);
        // Remove event listeners to prevent actions after unmount/reconnect attempt
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;

        // Only explicitly close if it's OPEN or CONNECTING.
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          console.log(`(Cleanup) Closing WebSocket (readyState: ${socket.readyState})`);
          socket.close();
        }

        // Nullify the ref if it points to this socket.
        if (ws.current === socket) {
          console.log('(Cleanup) Nullifying ws.current ref');
          ws.current = null;
        }
      }

      // Clear polling interval if it exists
      if (pollingInterval) {
        clearInterval(pollingInterval);
        console.log('(Cleanup) Cleared polling interval.');
      }
    };
  }, [fetchQueueStatus]); // Dependency on fetchQueueStatus

  return { queue };
}
