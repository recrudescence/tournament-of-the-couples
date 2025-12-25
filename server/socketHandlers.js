const gameState = require('./gameState');
const database = require('./database');
const roomCodeGenerator = require('./roomCodeGenerator');
const { handleHostJoin, handlePlayerReconnect, handleNewPlayerJoin } = require('./joinHandlers');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {

    // Create a new game (host only)
    socket.on('createGame', async ({ name }) => {
      console.log('[socket] createGame');
      try {
        // Generate room code
        const roomCode = roomCodeGenerator.generateRoomCode();

        // Initialize game state
        const state = gameState.initializeGame(roomCode);
        await database.createGame(roomCode);

        // Join the Socket.io room
        socket.join(roomCode);
        socket.roomCode = roomCode;

        // Create the host
        const result = handleHostJoin(roomCode, socket, name, state);

        if (result.success) {
          socket.emit('gameCreated', { roomCode, ...result.data });
        } else {
          socket.emit('error', { message: result.error });
        }

      } catch (err) {
        console.error('Create game error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Join existing game (new player or reconnect)
    socket.on('joinGame', async ({ name, isHost, isReconnect, roomCode }) => {
      console.log('[socket] joinGame')
      try {
        // Validate room code
        if (!roomCode || !roomCodeGenerator.validateRoomCode(roomCode)) {
          socket.emit('error', { message: 'Invalid room code' });
          return;
        }

        // Check if room exists
        if (!gameState.hasRoom(roomCode)) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        const state = gameState.getGameState(roomCode);

        // Join the Socket.io room
        socket.join(roomCode);
        socket.roomCode = roomCode;

        let result;

        console.log('debug:', roomCode, isHost, isReconnect, name)

        // Route to appropriate handler based on join type
        if (isHost) {
          result = handleHostJoin(roomCode, socket, name, state);
        } else if (isReconnect) {
          result = handlePlayerReconnect(roomCode, socket, name, state);
        } else {
          // Check for implicit reconnect (disconnected player joining without isReconnect flag)
          const existingPlayer = state.players.find(p => p.name === name);
          if (existingPlayer && !existingPlayer.connected) {
            result = handlePlayerReconnect(roomCode, socket, name, state);
          } else {
            console.log('x')
            result = handleNewPlayerJoin(roomCode, socket, name, isHost, state);
          }
        }

        // Handle result
        if (result.success) {
          socket.emit('joinSuccess', { roomCode, ...result.data });
          io.to(roomCode).emit('lobbyUpdate', gameState.getGameState(roomCode));
        } else {
          socket.emit('error', { message: result.error });
        }

      } catch (err) {
        console.error('Join error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Request to pair with another player
    socket.on('requestPair', ({ targetSocketId }) => {
      console.log('[socket] requestPair')
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.pairPlayers(roomCode, socket.id, targetSocketId);
        const state = gameState.getGameState(roomCode);
        io.to(roomCode).emit('lobbyUpdate', state);
      } catch (err) {
        console.error('Pair error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Unpair from partner
    socket.on('unpair', () => {
      console.log('[socket] unpair')
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.unpairPlayers(roomCode, socket.id);
        const state = gameState.getGameState(roomCode);
        io.to(roomCode).emit('lobbyUpdate', state);
      } catch (err) {
        console.error('Unpair error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host kicks a player from the lobby
    socket.on('kickPlayer', ({ targetSocketId }) => {
      console.log('[socket] kickPlayer', { targetSocketId });
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      const state = gameState.getGameState(roomCode);
      if (!state) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      // Verify requester is the host
      if (!state.host || state.host.socketId !== socket.id) {
        socket.emit('error', { message: 'Only the host can kick players' });
        return;
      }

      // Only allow kicking in lobby
      if (state.status !== 'lobby') {
        socket.emit('error', { message: 'Can only kick players in lobby' });
        return;
      }

      try {
        // Get the player's info before removing them
        const targetPlayer = state.players.find(p => p.socketId === targetSocketId);
        if (!targetPlayer) {
          socket.emit('error', { message: 'Player not found' });
          return;
        }

        // Remove the player from the game
        gameState.removePlayer(roomCode, targetSocketId);
        const updatedState = gameState.getGameState(roomCode);

        // Notify the kicked player
        io.to(targetSocketId).emit('playerKicked');

        // Update all other players in the lobby
        io.to(roomCode).emit('lobbyUpdate', updatedState);
      } catch (err) {
        console.error('Kick player error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Get lobby state
    socket.on('getLobbyState', () => {
      console.log('[socket] getLobbyState')
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      const state = gameState.getGameState(roomCode);
      socket.emit('lobbyUpdate', state);
    });

    // Get disconnected players (for reconnection UI) - DEPRECATED but kept for compatibility
    socket.on('getDisconnectedPlayers', () => {
      console.log('getDisconnectedPlayers');
      // This is now only used when no room code is known (initial connection)
      // Return empty list to show join form
      socket.emit('disconnectedPlayers', { players: [], canJoinAsNew: true });
    });

    // Check room status for join flow
    socket.on('checkRoomStatus', ({ roomCode }) => {
      console.log('[socket] checkRoomStatus')
      if (!roomCode || !roomCodeGenerator.validateRoomCode(roomCode.toLowerCase())) {
        socket.emit('roomStatus', {
          found: false,
          error: 'Invalid room code format'
        });
        return;
      }

      const normalizedCode = roomCode.toLowerCase();

      if (!gameState.hasRoom(normalizedCode)) {
        socket.emit('roomStatus', {
          found: false,
          error: 'Room not found'
        });
        return;
      }

      const state = gameState.getGameState(normalizedCode);
      const disconnectedPlayers = state.players
        .filter(p => !p.connected && !p.isHost && p.teamId)
        .map(p => ({ name: p.name, socketId: p.socketId, isHost: false }));

      // Add disconnected host if applicable
      if (state.host && !state.host.connected) {
        disconnectedPlayers.unshift({ name: state.host.name, socketId: state.host.socketId, isHost: true });
      }

      socket.emit('roomStatus', {
        found: true,
        roomCode: normalizedCode,
        status: state.status,
        inProgress: state.status === 'playing' || state.status === 'scoring',
        disconnectedPlayers,
        canJoinAsNew: state.status === 'lobby'
      });
    });

    // Host starts the game
    socket.on('startGame', () => {
      console.log('[socket] startGame')
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.startGame(roomCode);
        const state = gameState.getGameState(roomCode);
        console.log('Emitting gameStarted to room', roomCode, '. Players:', state.players.map(p => p.name));
        io.to(roomCode).emit('gameStarted', state);
      } catch (err) {
        console.error('Start game error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host starts a new round
    socket.on('startRound', async ({ question, variant, options }) => {
      console.log('[socket] startRound', { variant, optionsCount: options?.length });
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.startRound(roomCode, question, variant, options);
        const state = gameState.getGameState(roomCode);

        // Persist round to database
        const roundId = await database.saveRound(
          roomCode,  // gameId is now roomCode
          state.currentRound.roundNumber,
          question,
          variant,
          options
        );
        gameState.setCurrentRoundId(roomCode, roundId);

        io.to(roomCode).emit('roundStarted', {
          roundNumber: state.currentRound.roundNumber,
          question: state.currentRound.question,
          variant: state.currentRound.variant,
          options: state.currentRound.options,
          gameState: state
        });
      } catch (err) {
        console.error('Start round error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Player submits an answer
    socket.on('submitAnswer', async ({ answer, responseTime }) => {
      console.log('[socket] submitAnswer');
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.submitAnswer(roomCode, socket.id, answer, responseTime);
        const state = gameState.getGameState(roomCode);

        // Get player info for database
        const player = state.players.find(p => p.socketId === socket.id);

        // Persist answer to database
        if (state.currentRound.roundId) {
          await database.saveAnswer(
            state.currentRound.roundId,
            player.name,
            player.teamId,
            answer,
            responseTime
          );
        }

        // Notify ALL clients in the room (including host) that answer was submitted
        // Use player name as key (stable across reconnections)
        io.to(roomCode).emit('answerSubmitted', {
          playerName: player.name,
          answer: answer,
          responseTime: responseTime,
          submittedInCurrentPhase: state.currentRound.submittedInCurrentPhase,
          gameState: state
        });

        // Check if round is complete
        if (gameState.isRoundComplete(roomCode)) {
          gameState.completeRound(roomCode);
          const teams = gameState.getPlayerTeams(roomCode);
          io.to(roomCode).emit('allAnswersIn', { teams });
        }
      } catch (err) {
        console.error('Submit answer error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host reveals an answer
    socket.on('revealAnswer', ({ playerName }) => {
      console.log('[socket] revealAnswer:');
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        const state = gameState.getGameState(roomCode);
        const answerObj = state.currentRound.answers[playerName];
        const player = state.players.find(p => p.name === playerName);

        io.to(roomCode).emit('answerRevealed', {
          socketId: player.socketId,  // Still send socketId for client compatibility
          playerName: playerName,
          answer: answerObj.text,
          responseTime: answerObj.responseTime
        });
      } catch (err) {
        console.error('Reveal answer error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host awards point to team
    socket.on('awardPoint', ({ teamId }) => {
      console.log('[socket] awardPoint');
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.updateTeamScore(roomCode, teamId, 1);
        const state = gameState.getGameState(roomCode);
        const team = state.teams.find(t => t.teamId === teamId);

        io.to(roomCode).emit('scoreUpdated', { teamId, newScore: team.score });
      } catch (err) {
        console.error('Award point error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host removes point from team (for reopening scoring)
    socket.on('removePoint', ({ teamId }) => {
      console.log('[socket] removePoint');
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.updateTeamScore(roomCode, teamId, -1);
        const state = gameState.getGameState(roomCode);
        const team = state.teams.find(t => t.teamId === teamId);

        io.to(roomCode).emit('scoreUpdated', { teamId, newScore: team.score });
      } catch (err) {
        console.error('Remove point error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host moves to next round
    socket.on('nextRound', () => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.returnToPlaying(roomCode);
        const state = gameState.getGameState(roomCode);
        io.to(roomCode).emit('readyForNextRound', state);
      } catch (err) {
        console.error('Next round error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host returns to answering phase
    socket.on('backToAnswering', () => {
      console.log('[socket] backToAnswering');
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      console.log('backToAnswering event received for room', roomCode);
      try {
        gameState.returnToAnswering(roomCode);
        const state = gameState.getGameState(roomCode);
        console.log('Emitting returnedToAnswering to room', roomCode);
        io.to(roomCode).emit('returnedToAnswering', state);
      } catch (err) {
        console.error('Back to answering error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host ends the game
    socket.on('endGame', () => {
      console.log('[socket] endGame');
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.endGame(roomCode);
        const state = gameState.getGameState(roomCode);
        console.log('Game ended, emitting to room', roomCode);
        io.to(roomCode).emit('gameEnded', state);
      } catch (err) {
        console.error('End game error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('[socket] disconnect');
      const roomCode = socket.roomCode;
      if (!roomCode) return;

      const state = gameState.getGameState(roomCode);
      if (state) {
        // Check if this is the host
        if (state.host && state.host.socketId === socket.id) {
          gameState.disconnectHost(roomCode);
        } else {
          // In lobby: fully remove players so they must re-enter their name
          // During game: mark as disconnected to allow seamless reconnection
          if (state.status === 'lobby') {
            gameState.removePlayer(roomCode, socket.id);
          } else {
            gameState.disconnectPlayer(roomCode, socket.id);
          }
        }

        if (state.status === 'lobby') {
          io.to(roomCode).emit('lobbyUpdate', gameState.getGameState(roomCode));
        } else {
          io.to(roomCode).emit('playerDisconnected', { socketId: socket.id });
        }
      }
    });
  });
}

module.exports = { setupSocketHandlers };
