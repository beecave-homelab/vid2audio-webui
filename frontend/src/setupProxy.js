const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Proxy API requests (like /upload)
  app.use(
    '/upload', // Or use a more general path like '/api' if you have more routes
    createProxyMiddleware({
      target: 'http://backend:3001',
      changeOrigin: true,
    }),
  );

  // Proxy WebSocket requests
  app.use(
    '/app-ws', // Use a specific path for the application WebSocket
    createProxyMiddleware({
      target: 'ws://backend:3001', // Target the backend service with ws:// protocol
      ws: true, // Enable WebSocket proxying
      changeOrigin: true, // Needed for virtual hosted sites, but good practice here
    }),
  );

  // Add proxy for the download route as well
  app.use(
    '/download',
    createProxyMiddleware({
      target: 'http://backend:3001',
      changeOrigin: true,
    }),
  );
};
