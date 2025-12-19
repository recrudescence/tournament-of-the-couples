const gameState = require('./gameState');
const database = require('./database');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    // Join game (new player or reconnect)
    socket.on('joinGame', async ({ name, isHost, isReconnect }) => {
      try {
        let state = gameState.getGameState();
        
        // Initialize game if it doesn't exist
        if (!state) {
          state = gameState.initializeGame();
          await database.createGame(state.gameId);
        }

        if (isReconnect) {
          // Reconnect existing player
          const player = gameState.reconnectPlayer(name, socket.id);
          socket.emit('joinSuccess', { 
            player, 
            gameState: state,
            reconnected: true,
            isHost: false
          });
          io.emit('lobbyUpdate', state);
        } else {
          // Check if this is the host reconnecting
          if (isHost && state.host && state.host.name === name) {
            // Update host socket ID
            state.host.socketId = socket.id;
            console.log(`Host reconnected: ${name}`);
            socket.emit('joinSuccess', {
              socketId: socket.id,
              name,
              isHost: true,
              reconnected: true,
              gameState: state
            });
            io.emit('lobbyUpdate', state);
            return;
          }

          // Check if player with this name already exists (might be disconnected)
          const existingPlayer = state.players.find(p => p.name === name);

          if (existingPlayer) {
            // If disconnected, reconnect them
            if (!existingPlayer.connected) {
              const player = gameState.reconnectPlayer(name, socket.id);
              socket.emit('joinSuccess', {
                player,
                gameState: state,
                reconnected: true,
                isHost: false
              });
              io.emit('lobbyUpdate', state);
              return;
            } else {
              // Player with same name is already connected
              socket.emit('error', { message: 'Player name already exists' });
              return;
            }
          }

          // New player joining
          if (!gameState.canJoinAsNew()) {
            socket.emit('error', { message: 'Cannot join game in progress' });
            return;
          }

          gameState.addPlayer(socket.id, name, isHost);
          state = gameState.getGameState();

          socket.emit('joinSuccess', {
            socketId: socket.id,
            name,
            isHost,
            gameState: state
          });
          io.emit('lobbyUpdate', state);
        }
      } catch (err) {
        console.error('Join error:', err);
        socket.emit('error', { message: err.message });
      }
    });
    
    // Request to pair with another player
    socket.on('requestPair', ({ targetSocketId }) => {
      try {
        gameState.pairPlayers(socket.id, targetSocketId);
        const state = gameState.getGameState();
        io.emit('lobbyUpdate', state);
      } catch (err) {
        console.error('Pair error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Unpair from partner
    socket.on('unpair', () => {
      try {
        gameState.unpairPlayers(socket.id);
        const state = gameState.getGameState();
        io.emit('lobbyUpdate', state);
      } catch (err) {
        console.error('Unpair error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Get lobby state
    socket.on('getLobbyState', () => {
      const state = gameState.getGameState();
      socket.emit('lobbyUpdate', state);
    });

    // Get disconnected players (for reconnection UI)
    socket.on('getDisconnectedPlayers', () => {
        const state = gameState.getGameState();
        
        // If no game exists yet, allow joining as new
        if (!state) {
            socket.emit('disconnectedPlayers', { players: [], canJoinAsNew: true });
            return;
        }
        
        const disconnected = gameState.getDisconnectedPlayers();
        const canJoin = gameState.canJoinAsNew();
        socket.emit('disconnectedPlayers', { players: disconnected, canJoinAsNew: canJoin });
    });

    // Host starts the game
    socket.on('startGame', () => {
      try {
        gameState.startGame();
        const state = gameState.getGameState();
        console.log('Emitting gameStarted to all clients. Players:', state.players.map(p => p.name));
        io.emit('gameStarted', state);
      } catch (err) {
        console.error('Start game error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host starts a new round
    socket.on('startRound', async ({ question }) => {
      try {
        gameState.startRound(question);
        const state = gameState.getGameState();
        
        // Persist round to database
        const roundId = await database.saveRound(
          state.gameId,
          state.currentRound.roundNumber,
          question
        );
        gameState.setCurrentRoundId(roundId);
        
        io.emit('roundStarted', { 
          roundNumber: state.currentRound.roundNumber,
          question 
        });
      } catch (err) {
        console.error('Start round error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Player submits an answer
    socket.on('submitAnswer', async ({ answer }) => {
      try {
        gameState.submitAnswer(socket.id, answer);
        const state = gameState.getGameState();

        // Get player info for database
        const player = state.players.find(p => p.socketId === socket.id);

        // Persist answer to database
        if (state.currentRound.roundId) {
          await database.saveAnswer(
            state.currentRound.roundId,
            player.name,
            player.teamId,
            answer
          );
        }

        // Notify ALL clients (including host) that answer was submitted
        // Use player name as key (stable across reconnections)
        io.emit('answerSubmitted', {
          playerName: player.name,
          answer: answer,
          submittedInCurrentPhase: state.currentRound.submittedInCurrentPhase
        });

        // Check if round is complete
        if (gameState.isRoundComplete()) {
          gameState.completeRound();
          const teams = gameState.getPlayerTeams();
          io.emit('allAnswersIn', { teams });
        }
      } catch (err) {
        console.error('Submit answer error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host reveals an answer
    socket.on('revealAnswer', ({ playerName }) => {
      try {
        const state = gameState.getGameState();
        const answer = state.currentRound.answers[playerName];
        const player = state.players.find(p => p.name === playerName);

        io.emit('answerRevealed', {
          socketId: player.socketId,  // Still send socketId for client compatibility
          playerName: playerName,
          answer
        });
      } catch (err) {
        console.error('Reveal answer error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host awards point to team
    socket.on('awardPoint', ({ teamId }) => {
      try {
        gameState.updateTeamScore(teamId, 1);
        const state = gameState.getGameState();
        const team = state.teams.find(t => t.teamId === teamId);
        
        io.emit('scoreUpdated', { teamId, newScore: team.score });
      } catch (err) {
        console.error('Award point error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host moves to next round
    socket.on('nextRound', () => {
      try {
        gameState.returnToPlaying();
        const state = gameState.getGameState();
        io.emit('readyForNextRound', state);
      } catch (err) {
        console.error('Next round error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host returns to answering phase
    socket.on('backToAnswering', () => {
      console.log('backToAnswering event received');
      try {
        gameState.returnToAnswering();
        const state = gameState.getGameState();
        console.log('Emitting returnedToAnswering to all clients');
        io.emit('returnedToAnswering', state);
      } catch (err) {
        console.error('Back to answering error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const state = gameState.getGameState();
      if (state) {
        // Always mark as disconnected (don't remove from lobby)
        // This allows for seamless reconnection on page transitions
        gameState.disconnectPlayer(socket.id);
        
        if (state.status === 'lobby') {
          io.emit('lobbyUpdate', gameState.getGameState());
        } else {
          io.emit('playerDisconnected', { socketId: socket.id });
        }
      }
    });
  });
}

module.exports = { setupSocketHandlers };
