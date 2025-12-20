const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const gameState = require('./gameState');
const db = require('./database');
const { setupSocketHandlers } = require('./socketHandlers');

db.init().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files - use dist folder for production builds, public for legacy
const fs = require('fs');
const distPath = path.join(__dirname, '..', 'dist');
const publicPath = path.join(__dirname, '..', 'public');

// Check if dist folder exists (production build)
if (fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(express.static(distPath));

  // SPA fallback - serve index.html for all routes (Express 5 syntax)
  app.get('/{*path}', (req, res, next) => {
    // Skip socket.io requests
    if (req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Development fallback - serve legacy public folder
  app.use(express.static(publicPath));

  app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  app.get('/lobby', (req, res) => {
    res.sendFile(path.join(publicPath, 'lobby.html'));
  });

  app.get('/host', (req, res) => {
    res.sendFile(path.join(publicPath, 'host.html'));
  });

  app.get('/player', (req, res) => {
    res.sendFile(path.join(publicPath, 'player.html'));
  });
}

// Socket.io connection handling
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
