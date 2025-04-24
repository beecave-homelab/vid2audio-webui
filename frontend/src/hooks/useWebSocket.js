import { useState, useEffect, useCallback } from 'react';

const useWebSocket = (url) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log(`[useWebSocket] WebSocket opened for URL: ${url}`);
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      console.log('[useWebSocket] onmessage triggered');
      console.log('[useWebSocket] Raw message data:', event.data);
      setLastMessage(event);
    };

    ws.onerror = (event) => {
      console.error('[useWebSocket] WebSocket error:', event);
      setError('WebSocket error');
    };

    ws.onclose = () => {
      console.log('[useWebSocket] WebSocket closed.');
      setIsConnected(false);
    };

    setSocket(ws);

    // Clean up on unmount
    return () => {
      ws.close();
    };
  }, [url]);

  // Send message function
  const sendMessage = useCallback((data) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify(data));
    } else {
      setError('WebSocket not connected');
    }
  }, [socket, isConnected]);

  return { isConnected, lastMessage, error, sendMessage };
};

export default useWebSocket; 