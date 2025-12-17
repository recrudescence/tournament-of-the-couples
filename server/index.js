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

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/lobby', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'lobby.html'));
});

app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'host.html'));
});

app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'player.html'));
});

// Socket.io connection handling
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
