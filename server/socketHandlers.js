const gameState = require('./gameState');
const database = require('./database');
const roomCodeGenerator = require('./roomCodeGenerator');
const { handleHostJoin, handlePlayerReconnect, handleNewPlayerJoin } = require('./joinHandlers');
const botManager = require('./botManager');

// Track pending room deletions (for host disconnect grace period)
const pendingDeletions = new Map();
const HOST_DISCONNECT_GRACE_PERIOD = 5000; // 5 seconds

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {

    // Create a new game (host only)
    socket.on('createGame', async ({ name }) => {
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

        // Route to appropriate handler based on join type
        if (isHost) {
          // Cancel any pending room deletion (host is reconnecting)
          if (pendingDeletions.has(roomCode)) {
            clearTimeout(pendingDeletions.get(roomCode));
            pendingDeletions.delete(roomCode);
            console.log(`Cancelled pending deletion for ${roomCode} - host reconnected`);
          }
          result = handleHostJoin(roomCode, socket, name, state);
        } else if (isReconnect) {
          result = handlePlayerReconnect(roomCode, socket, name, state);
        } else {
          // Check for implicit reconnect (disconnected player joining without isReconnect flag)
          const existingPlayer = state.players.find(p => p.name === name);
          if (existingPlayer && !existingPlayer.connected) {
            result = handlePlayerReconnect(roomCode, socket, name, state);
          } else {
            result = handleNewPlayerJoin(roomCode, socket, name, isHost, state);
          }
        }

        // Handle result
        if (result.success) {
          socket.emit('joinSuccess', { roomCode, ...result.data });
          io.to(roomCode).emit('lobbyUpdate', gameState.getGameState(roomCode));

          // If reconnecting during active game, broadcast state update to all players
          // so they can update stale socket IDs
          if (result.data.reconnected && state.status !== 'lobby') {
            io.to(roomCode).emit('playerReconnected', {
              name: result.data.name,
              newSocketId: socket.id,
              gameState: gameState.getGameState(roomCode)
            });
          }
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

    // Randomize player's avatar
    socket.on('randomizeAvatar', () => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.randomizePlayerAvatar(roomCode, socket.id);
        const state = gameState.getGameState(roomCode);
        io.to(roomCode).emit('lobbyUpdate', state);
      } catch (err) {
        console.error('Randomize avatar error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host adds bot players (test mode)
    socket.on('addBots', ({ count }) => {
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

      if (!state.host || state.host.socketId !== socket.id) {
        socket.emit('error', { message: 'Only the host can add bots' });
        return;
      }

      if (state.status !== 'lobby') {
        socket.emit('error', { message: 'Can only add bots in lobby' });
        return;
      }

      try {
        botManager.addBots(roomCode, count);
        io.to(roomCode).emit('lobbyUpdate', gameState.getGameState(roomCode));
      } catch (err) {
        console.error('Add bots error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host removes all bot players (test mode)
    socket.on('removeBots', () => {
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

      if (!state.host || state.host.socketId !== socket.id) {
        socket.emit('error', { message: 'Only the host can remove bots' });
        return;
      }

      if (state.status !== 'lobby') {
        socket.emit('error', { message: 'Can only remove bots in lobby' });
        return;
      }

      try {
        botManager.removeAllBots(roomCode);
        io.to(roomCode).emit('lobbyUpdate', gameState.getGameState(roomCode));
      } catch (err) {
        console.error('Remove bots error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host kicks a player
    socket.on('kickPlayer', ({ targetSocketId }) => {
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

      try {
        // Get the player's info before removing them
        const targetPlayer = state.players.find(p => p.socketId === targetSocketId);
        if (!targetPlayer) {
          socket.emit('error', { message: 'Player not found' });
          return;
        }

        if (state.status === 'lobby') {
          // In lobby: fully remove the player
          gameState.removePlayer(roomCode, targetSocketId);
        } else {
          // During gameplay: mark as disconnected (keeps team intact)
          gameState.disconnectPlayer(roomCode, targetSocketId);
        }

        const updatedState = gameState.getGameState(roomCode);

        // Only notify real players (bots have no socket)
        if (!botManager.isBot(targetSocketId)) {
          // Notify the kicked player
          io.to(targetSocketId).emit('playerKicked');

          // Force disconnect the kicked player's socket
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket) {
            targetSocket.leave(roomCode);
            delete targetSocket.roomCode;
          }
        }

        // Update all other players
        io.to(roomCode).emit('lobbyUpdate', updatedState);
      } catch (err) {
        console.error('Kick player error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Player explicitly leaves the game
    socket.on('leaveGame', () => {
      const roomCode = socket.roomCode;
      if (!roomCode) return;

      const state = gameState.getGameState(roomCode);
      if (!state) return;

      // In lobby: remove player completely
      // During game: mark as disconnected
      if (state.status === 'lobby') {
        // Check if this is the host or a player
        if (state.host && state.host.socketId === socket.id) {
          // Host leaving lobby cancels the entire game
          console.log(`Host leaving lobby, cancelling game ${roomCode}`);

          // Notify all players that the game was cancelled
          io.to(roomCode).emit('gameCancelled', { reason: 'Host left the lobby' });

          // Delete the game state
          gameState.deleteRoom(roomCode);
        } else {
          gameState.removePlayer(roomCode, socket.id);
          io.to(roomCode).emit('lobbyUpdate', gameState.getGameState(roomCode));
        }
      } else {
        // During active game, just mark as disconnected
        if (state.host && state.host.socketId === socket.id) {
          gameState.disconnectHost(roomCode);
          io.to(roomCode).emit('playerDisconnected', { socketId: socket.id, name: state.host.name });
        } else {
          const player = state.players.find(p => p.socketId === socket.id);
          gameState.disconnectPlayer(roomCode, socket.id);
          io.to(roomCode).emit('playerDisconnected', { socketId: socket.id, name: player?.name });
        }
      }

      // Clean up socket's room association
      socket.leave(roomCode);
      socket.roomCode = null;
    });

    // Get lobby state
    socket.on('getLobbyState', () => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      const state = gameState.getGameState(roomCode);
      socket.emit('lobbyUpdate', state);
    });

    // Check room status for join flow
    socket.on('checkRoomStatus', ({ roomCode }) => {
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
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.startGame(roomCode);

        // If imported questions exist, advance cursor before emitting gameStarted
        // so that the gameState already contains the cursor when clients receive it.
        // (HostPage mounts after gameStarted; a separate cursorAdvanced would be missed.)
        if (gameState.getGameState(roomCode).importedQuestions) {
          const cursorData = gameState.advanceCursor(roomCode);
          console.log(`[Import] Room ${roomCode}: game started in imported mode, first question: "${cursorData?.question?.question}"`);
        }

        const state = gameState.getGameState(roomCode);
        io.to(roomCode).emit('gameStarted', state);
      } catch (err) {
        console.error('Start game error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host starts a new round
    socket.on('startRound', async ({ question, variant, options, answerForBoth = false }) => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        // Get round count from database to derive next round number
        const roundCount = await database.getRoundCount(roomCode);
        const roundNumber = roundCount + 1;

        gameState.startRound(roomCode, question, variant, options, answerForBoth, roundNumber);
        const state = gameState.getGameState(roomCode);

        // Persist round to database
        const roundId = await database.saveRound(
          roomCode,  // gameId is now roomCode
          roundNumber,
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
          answerForBoth: state.currentRound.answerForBoth,
          questionCreatedAt: state.currentRound.createdAt,
          gameState: state
        });

        // Schedule bot answers
        botManager.scheduleBotAnswers(roomCode, io);
      } catch (err) {
        console.error('Start round error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Player submits an answer
    socket.on('submitAnswer', async ({ answer, responseTime }) => {
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
          // For pool_selection, emit poolReady instead of allAnswersIn
          if (state.currentRound.variant === 'pool_selection') {
            // Transition to selecting phase
            gameState.startSelecting(roomCode);
            const answerPool = gameState.getAnswerPool(roomCode);
            io.to(roomCode).emit('poolReady', {
              answers: answerPool,
              gameState: gameState.getGameState(roomCode)
            });
            // Schedule bot picks
            botManager.scheduleBotPicks(roomCode, io);
          } else {
            gameState.completeRound(roomCode);
            io.to(roomCode).emit('allAnswersIn');
          }
        }
      } catch (err) {
        console.error('Submit answer error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Player submits a pick (pool selection mode)
    socket.on('submitPick', async ({ pickedAnswer }) => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.submitPick(roomCode, socket.id, pickedAnswer);
        const state = gameState.getGameState(roomCode);
        const player = state.players.find(p => p.socketId === socket.id);

        // Notify all clients
        io.to(roomCode).emit('pickSubmitted', {
          playerName: player.name,
          picksSubmitted: state.currentRound.picksSubmitted,
          gameState: state
        });

        // Check if all picks are in
        if (gameState.areAllPicksIn(roomCode)) {
          gameState.completeRound(roomCode);
          io.to(roomCode).emit('allPicksIn');
        }
      } catch (err) {
        console.error('Submit pick error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host reveals pickers for an answer (pool selection mode)
    socket.on('revealPickers', ({ answerText }) => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        const pickers = gameState.getPickersForAnswer(roomCode, answerText);
        io.to(roomCode).emit('pickersRevealed', { answerText, pickers });
      } catch (err) {
        console.error('Reveal pickers error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host reveals author of an answer (pool selection mode)
    socket.on('revealAuthor', ({ answerText }) => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        const author = gameState.getAuthorOfAnswer(roomCode, answerText);
        if (!author) {
          socket.emit('error', { message: 'Author not found' });
          return;
        }

        const { correctPickers, teamId } = gameState.checkCorrectPick(roomCode, answerText);

        // Auto-award point for correct guesses
        if (teamId) {
          gameState.updateTeamScore(roomCode, teamId, 1);
        }

        io.to(roomCode).emit('authorRevealed', {
          answerText,
          author,
          correctPickers,
          teamId
        });

        // If point was awarded, also emit scoreUpdated
        if (teamId) {
          const state = gameState.getGameState(roomCode);
          const team = state.teams.find(t => t.teamId === teamId);
          io.to(roomCode).emit('scoreUpdated', {
            teamId,
            newScore: team.score,
            pointsAwarded: 1
          });
        }
      } catch (err) {
        console.error('Reveal author error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host starts scoring (can be called before all answers are in for force-start)
    socket.on('startScoring', () => {
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
        socket.emit('error', { message: 'Only the host can start scoring' });
        return;
      }

      try {
        // Mark round as complete (sets status to 'scoring')
        gameState.completeRound(roomCode);
        const updatedState = gameState.getGameState(roomCode);

        // Notify all clients that scoring has begun
        io.to(roomCode).emit('scoringStarted', updatedState);
      } catch (err) {
        console.error('Start scoring error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host reveals an answer
    socket.on('revealAnswer', ({ playerName }) => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        const state = gameState.getGameState(roomCode);

        // For dual answer mode, playerName may be "responder:subject" format (e.g., "Bob:Alice")
        // Extract the responder name to look up their answer
        const isDualKey = playerName.includes(':');
        const responderName = isDualKey ? playerName.split(':')[0] : playerName;

        if (isDualKey) {
          // Dual mode: look up the responder's full answer (contains JSON for both players)
          const answerObj = state.currentRound.answers[responderName];
          const player = state.players.find(p => p.name === responderName);

          io.to(roomCode).emit('answerRevealed', {
            socketId: player?.socketId,
            playerName, // Full composite key for HostPage matching
            responderName, // Simple name for PlayerPage display
            answer: answerObj?.text,
            responseTime: answerObj?.responseTime
          });
        } else {
          // Single mode: look up the actual answer
          const answerObj = state.currentRound.answers[playerName];
          const player = state.players.find(p => p.name === playerName);

          io.to(roomCode).emit('answerRevealed', {
            socketId: player?.socketId,
            playerName: playerName,
            answer: answerObj?.text,
            responseTime: answerObj?.responseTime
          });
        }
      } catch (err) {
        console.error('Reveal answer error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host awards point to team
    socket.on('awardPoint', ({ teamId, points = 1 }) => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.updateTeamScore(roomCode, teamId, points);
        const state = gameState.getGameState(roomCode);
        const team = state.teams.find(t => t.teamId === teamId);

        io.to(roomCode).emit('scoreUpdated', { teamId, newScore: team.score, pointsAwarded: points });
      } catch (err) {
        console.error('Award point error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host skips scoring for a team (awards 0 points)
    socket.on('skipPoint', ({ teamId }) => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        const state = gameState.getGameState(roomCode);
        const team = state.teams.find(t => t.teamId === teamId);
        if (!team) {
          socket.emit('error', { message: 'Team not found' });
          return;
        }

        io.to(roomCode).emit('scoreUpdated', { teamId, newScore: team.score, pointsAwarded: 0 });
      } catch (err) {
        console.error('Skip point error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host removes point from team (for reopening scoring)
    socket.on('removePoint', ({ teamId, points = 1 }) => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.updateTeamScore(roomCode, teamId, -points);
        const state = gameState.getGameState(roomCode);
        const team = state.teams.find(t => t.teamId === teamId);

        io.to(roomCode).emit('scoreUpdated', { teamId, newScore: team.score, pointsAwarded: -points });
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
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        gameState.returnToAnswering(roomCode);
        const state = gameState.getGameState(roomCode);
        io.to(roomCode).emit('returnedToAnswering', state);

        // Re-schedule bot answers
        botManager.scheduleBotAnswers(roomCode, io);
      } catch (err) {
        console.error('Back to answering error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host ends the game
    socket.on('endGame', () => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        botManager.cancelBotTimers(roomCode);
        gameState.endGame(roomCode);
        const state = gameState.getGameState(roomCode);
        io.to(roomCode).emit('gameEnded', state);
      } catch (err) {
        console.error('End game error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host resets the game back to lobby
    socket.on('resetGame', () => {
      const roomCode = socket.roomCode;
      if (!roomCode) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      try {
        botManager.cancelBotTimers(roomCode);
        gameState.resetGame(roomCode);
        const state = gameState.getGameState(roomCode);
        io.to(roomCode).emit('gameReset', state);
      } catch (err) {
        console.error('Reset game error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host advances cursor to next question (imported mode)
    socket.on('advanceCursor', () => {
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
        socket.emit('error', { message: 'Only the host can advance the cursor' });
        return;
      }

      try {
        const cursorData = gameState.advanceCursor(roomCode);
        if (cursorData) {
          console.log(`[Import] Room ${roomCode}: cursor advanced to ch${cursorData.chapterIndex}:q${cursorData.questionIndex}${cursorData.isNewChapter ? ' (new chapter)' : ''}${cursorData.isLastQuestion ? ' (last question)' : ''}`);
          io.to(roomCode).emit('cursorAdvanced', {
            ...cursorData,
            gameState: gameState.getGameState(roomCode)
          });
        } else {
          console.log(`[Import] Room ${roomCode}: all questions completed`);
          // No more questions
          io.to(roomCode).emit('allQuestionsCompleted');
        }
      } catch (err) {
        console.error('Advance cursor error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    // Host sends reveal update to sync players (imported mode)
    socket.on('sendRevealUpdate', ({ stage, chapterTitle, variant }) => {
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
        socket.emit('error', { message: 'Only the host can send reveal updates' });
        return;
      }

      // Broadcast to all players in the room
      io.to(roomCode).emit('revealUpdate', { stage, chapterTitle, variant });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const roomCode = socket.roomCode;
      if (!roomCode) return;

      const state = gameState.getGameState(roomCode);
      if (state) {
        // Check if this is the host
        if (state.host && state.host.socketId === socket.id) {
          // Host disconnecting in lobby - schedule deletion with grace period for refresh
          if (state.status === 'lobby') {
            console.log(`Host disconnected from lobby, scheduling deletion for ${roomCode}`);
            gameState.disconnectHost(roomCode);
            io.to(roomCode).emit('lobbyUpdate', gameState.getGameState(roomCode));

            // Cancel any existing pending deletion
            if (pendingDeletions.has(roomCode)) {
              clearTimeout(pendingDeletions.get(roomCode));
            }

            // Schedule room deletion after grace period
            const timeout = setTimeout(() => {
              const currentState = gameState.getGameState(roomCode);
              // Only delete if host is still disconnected
              if (currentState && currentState.host && !currentState.host.connected) {
                console.log(`Grace period expired, deleting room ${roomCode}`);
                botManager.cancelBotTimers(roomCode);
                io.to(roomCode).emit('gameCancelled', { reason: 'Host disconnected' });
                gameState.deleteRoom(roomCode);
              }
              pendingDeletions.delete(roomCode);
            }, HOST_DISCONNECT_GRACE_PERIOD);

            pendingDeletions.set(roomCode, timeout);
          } else {
            // During active game, just mark as disconnected
            const hostName = state.host.name;
            gameState.disconnectHost(roomCode);
            io.to(roomCode).emit('playerDisconnected', { socketId: socket.id, name: hostName });
          }
        } else {
          // In lobby: fully remove players so they must re-enter their name
          // During game: mark as disconnected to allow seamless reconnection
          if (state.status === 'lobby') {
            gameState.removePlayer(roomCode, socket.id);
            io.to(roomCode).emit('lobbyUpdate', gameState.getGameState(roomCode));
          } else {
            const player = state.players.find(p => p.socketId === socket.id);
            gameState.disconnectPlayer(roomCode, socket.id);
            io.to(roomCode).emit('playerDisconnected', { socketId: socket.id, name: player?.name });
          }
        }
      }
    });
  });
}

module.exports = { setupSocketHandlers };
