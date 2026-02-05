const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const gameState = require('./gameState');
const db = require('./database');
const { setupSocketHandlers } = require('./socketHandlers');
const questionImporter = require('./questionImporter');

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

// Parse JSON bodies for API endpoints
app.use(express.json({ limit: '1mb' }));

// API endpoint to list all active games (must be before static/SPA fallback)
app.get('/api/games', (req, res) => {
  try {
    const activeGames = gameState.getAllGames();

    const gameList = activeGames
      .filter(game => game.host) // Only include games with a host
      .map(game => ({
        roomCode: game.roomCode,
        hostName: game.host.name,
        hostAvatar: game.host.avatar,
        status: game.status, // 'lobby', 'playing', 'scoring', 'ended'
        playerCount: game.players.length,
        canJoin: game.status !== 'ended' // All states except 'ended' are joinable (lobby for new, playing/scoring for reconnect)
      }));

    res.json({ games: gameList });
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Import questions for a game
app.post('/api/games/:roomCode/questions', (req, res) => {
  try {
    const { roomCode } = req.params;
    const { content } = req.body;

    // Validate request
    if (!content) {
      return res.status(400).json({ error: 'Missing content' });
    }

    // Check room exists
    if (!gameState.hasRoom(roomCode)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const state = gameState.getGameState(roomCode);

    // Check game is in lobby
    if (state.status !== 'lobby') {
      return res.status(400).json({ error: 'Can only import questions in lobby' });
    }

    // Parse content
    const parseResult = questionImporter.parseJSON(content);

    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error });
    }

    // Validate question set
    const validation = questionImporter.validateQuestionSet(parseResult.data);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Store questions
    gameState.setImportedQuestions(roomCode, parseResult.data);

    const questionCount = questionImporter.countQuestions(parseResult.data);
    const chapterCount = parseResult.data.chapters.length;

    console.log(`[Import] Room ${roomCode}: imported "${parseResult.data.title}" (${chapterCount} chapters, ${questionCount} questions)`);

    // Broadcast to room via socket

    io.to(roomCode).emit('questionsImported', {
      questionCount,
      chapterCount,
      title: parseResult.data.title
    });

    res.json({
      title: parseResult.data.title,
      chapterCount,
      questionCount
    });
  } catch (error) {
    console.error('Error importing questions:', error);
    res.status(500).json({ error: 'Failed to import questions' });
  }
});

// Clear imported questions
app.delete('/api/games/:roomCode/questions', (req, res) => {
  try {
    const { roomCode } = req.params;

    // Check room exists
    if (!gameState.hasRoom(roomCode)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const state = gameState.getGameState(roomCode);

    // Check game is in lobby
    if (state.status !== 'lobby') {
      return res.status(400).json({ error: 'Can only clear questions in lobby' });
    }

    // Clear questions
    gameState.clearImportedQuestions(roomCode);

    // Broadcast to room
    io.to(roomCode).emit('questionsCleared');

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing questions:', error);
    res.status(500).json({ error: 'Failed to clear questions' });
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
