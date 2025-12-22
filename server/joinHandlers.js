const gameState = require('./gameState');

/**
 * Handle host joining (new or reconnect)
 * @param {string} roomCode - Room code
 * @param {Object} socket - Socket.io socket instance
 * @param {string} name - Host name
 * @param {Object} state - Current game state
 * @returns {Object} - Response object with { success, data?, error? }
 */
function handleHostJoin(roomCode, socket, name, state) {
  // Check if this is the host reconnecting
  if (state.host && state.host.name === name) {
    // Reconnect the host
    gameState.reconnectHost(roomCode, socket.id);
    const updatedState = gameState.getGameState(roomCode);

    return {
      success: true,
      data: {
        socketId: socket.id,
        name,
        isHost: true,
        reconnected: true,
        gameState: updatedState
      }
    };
  }

  // NEW: Initial host creation (FIXES THE BUG!)
  if (!state.host) {
    gameState.addPlayer(roomCode, socket.id, name, true);
    const updatedState = gameState.getGameState(roomCode);
    console.log(`Host created: ${name}`);

    return {
      success: true,
      data: {
        socketId: socket.id,
        name,
        isHost: true,
        reconnected: false,
        gameState: updatedState
      }
    };
  }

  // Invalid: host exists but name doesn't match
  return { success: false, error: 'Host name does not match' };
}

/**
 * Handle player reconnection (by name)
 * @param {string} roomCode - Room code
 * @param {Object} socket - Socket.io socket instance
 * @param {string} name - Player name
 * @param {Object} state - Current game state
 * @returns {Object} - Response object with { success, data?, error? }
 */
function handlePlayerReconnect(roomCode, socket, name, state) {
  // Try to find existing player with this name
  const existingPlayer = state.players.find(p => p.name === name);

  if (!existingPlayer) {
    return { success: false, error: 'Player not found' };
  }

  // If player is already connected, reject (duplicate)
  if (existingPlayer.connected) {
    return { success: false, error: 'Player name already exists' };
  }

  // Reconnect the player
  const player = gameState.reconnectPlayer(roomCode, name, socket.id);
  // Get the updated game state after reconnect
  const updatedState = gameState.getGameState(roomCode);

  return {
    success: true,
    data: {
      socketId: socket.id,
      name: player.name,
      isHost: false,
      player: player,
      gameState: updatedState,
      reconnected: true
    }
  };
}

/**
 * Handle new player joining
 * @param {string} roomCode - Room code
 * @param {Object} socket - Socket.io socket instance
 * @param {string} name - Player name
 * @param {boolean} isHost - Whether joining as host
 * @param {Object} state - Current game state
 * @returns {Object} - Response object with { success, data?, error? }
 */
function handleNewPlayerJoin(roomCode, socket, name, isHost, state) {
  // Check if new players can join (must be in lobby)
  if (!gameState.canJoinAsNew(roomCode)) {
    return { success: false, error: 'Cannot join game in progress' };
  }

  // Check if player name already exists (shouldn't happen, but defensive)
  const existingPlayer = state.players.find(p => p.name === name);
  if (existingPlayer) {
    return { success: false, error: 'Player name already exists' };
  }

  // Add the new player
  gameState.addPlayer(roomCode, socket.id, name, isHost);
  const updatedState = gameState.getGameState(roomCode);

  return {
    success: true,
    data: {
      socketId: socket.id,
      name,
      isHost,
      gameState: updatedState
    }
  };
}

module.exports = {
  handleHostJoin,
  handlePlayerReconnect,
  handleNewPlayerJoin
};
