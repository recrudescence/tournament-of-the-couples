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

// API endpoint to list all active games (must be before static/SPA fallback)
app.get('/api/games', (req, res) => {
  try {
    const activeGames = gameState.getAllGames();

    const gameList = activeGames
      .filter(game => game.host) // Only include games with a host
      .map(game => ({
        roomCode: game.roomCode,
        hostName: game.host.name,
        status: game.status, // 'lobby', 'playing', 'scoring'
        playerCount: game.players.length,
        canJoin: game.status === 'lobby' || game.status === 'playing' // Joinable states
      }));

    res.json({ games: gameList });
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Check if dist folder exists (production build)
if (fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(express.static(distPath));

  // SPA fallback - serve index.html for all routes (Express 5 syntax)
  app.get('/{*path}', (req, res, next) => {
    // Skip socket.io and api requests
    if (req.path.startsWith('/socket.io') || req.path.startsWith('/api/')) {
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
