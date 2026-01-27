const roomCodeGenerator = require('./roomCodeGenerator');

// In-memory game states - Map of roomCode -> gameState
const gameStates = new Map();

// Avatar generation helpers - cohesive pastel palette
const PASTEL_COLORS = [
  // Pinks & Roses
  '#F8C8DC', '#F4A4C0',
  // Peaches & Corals
  '#FFD4B8', '#FFCBA4',
  // Yellows & Creams
  '#FFF5BA', '#F8E8A0',
  // Greens & Mints
  '#C8E8D4', '#B4E4C8',
  // Blues & Aquas
  '#B4D8E8', '#A4D0E8',
  // Purples & Lavenders
  '#D4C4E8', '#E0D0F0',
  // Neutrals
  '#E8E4E0', '#F0E8E4',
];

const AVATAR_EMOJIS = [
  '😀', '😎', '🥳', '🤠', '🦊', '🐱', '🐶', '🐼', '🦁', '🐯',
  '🐸', '🐵', '🦄', '🐲', '🌸', '🌻', '🍀', '🌈', '⭐', '🔥',
  '💎', '🎈', '🎨', '🎭', '🎪', '🚀', '🌙', '☀️', '🍕', '🧁',
  '🦋', '🍄', '🌴', '🎸', '🎯', '🧸', '🦩', '🐝', '🍩', '🎀',
];

function generateRandomAvatar() {
  const color = PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
  const emoji = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
  return { color, emoji };
}

// Initialize a new game
function initializeGame(roomCode) {
  const gameState = {
    roomCode,
    gameId: roomCode,  // For database compatibility
    status: 'lobby', // 'lobby' | 'playing' | 'scoring' | 'ended'
    host: null,
    players: [],
    teams: [],
    currentRound: null,
    teamTotalResponseTimes: {} // Cumulative response times per team (teamId -> total ms)
  };

  gameStates.set(roomCode, gameState);
  console.log('Game initialized:', roomCode);
  return gameState;
}

// Add a player or host
function addPlayer(roomCode, socketId, name, isHost = false) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  if (isHost) {
    gameState.host = { socketId, name, connected: true, avatar: generateRandomAvatar() };
    console.log(`Host added: ${name}`);
  } else {
    // Check if player name matches host name
    if (gameState.host && gameState.host.name === name) {
      throw new Error('This name is already taken by the host');
    }

    // Check if player name already exists among other players
    const existing = gameState.players.find(p => p.name === name);
    if (existing) {
      throw new Error('Player name already exists');
    }

    gameState.players.push({
      socketId,
      name,
      partnerId: null,
      teamId: null,
      connected: true,
      avatar: generateRandomAvatar()
    });
    console.log(`Player added: ${name}`);
  }
}

// Remove a player (only used in lobby)
function removePlayer(roomCode, socketId) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) return;

  const playerIndex = gameState.players.findIndex(p => p.socketId === socketId);
  if (playerIndex === -1) return;

  const player = gameState.players[playerIndex];

  // If player was paired, unpair them first
  if (player.partnerId) {
    unpairPlayers(roomCode, socketId);
  }

  gameState.players.splice(playerIndex, 1);
  console.log(`Player removed: ${player.name}`);
}

// Mark player as disconnected (during game)
function disconnectPlayer(roomCode, socketId) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) return;

  const player = gameState.players.find(p => p.socketId === socketId);
  if (player) {
    player.connected = false;
    console.log(`<${player.name}> disconnected`);
  }
}

// Reconnect a player
function reconnectPlayer(roomCode, name, newSocketId) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  const player = gameState.players.find(p => p.name === name);
  if (!player) {
    throw new Error('Player not found');
  }

  const oldSocketId = player.socketId;
  player.socketId = newSocketId;
  player.connected = true;

  // Update partner's reference to this player
  if (player.partnerId) {
    const partner = gameState.players.find(p => p.socketId === player.partnerId);
    if (partner && partner.partnerId === oldSocketId) {
      partner.partnerId = newSocketId;
    }
  }

  // Update team references
  if (player.teamId) {
    const team = gameState.teams.find(t => t.teamId === player.teamId);
    if (team) {
      if (team.player1Id === oldSocketId) {
        team.player1Id = newSocketId;
      }
      if (team.player2Id === oldSocketId) {
        team.player2Id = newSocketId;
      }
    }
  }

  // No need to migrate answers anymore - they're keyed by player name which doesn't change!

  console.log(`<${name}> rejoined`);
  return player;
}

// Get list of disconnected players
function getDisconnectedPlayers(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) return [];
  return gameState.players
    .filter(p => !p.connected)
    .map(p => ({ name: p.name }));
}

// Mark host as disconnected
function disconnectHost(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.host) return;

  gameState.host.connected = false;
  console.log(`<${gameState.host.name}> (host) disconnected`);
}

// Reconnect the host
function reconnectHost(roomCode, newSocketId) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.host) {
    throw new Error('Host not found');
  }

  gameState.host.socketId = newSocketId;
  gameState.host.connected = true;
  console.log(`<${gameState.host.name}> (host) reconnected`);
}

// Check if new players can join
function canJoinAsNew(roomCode) {
  const gameState = gameStates.get(roomCode);
  return gameState && gameState.status === 'lobby';
}

// Pair two players into a team
function pairPlayers(roomCode, socketId1, socketId2) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  const player1 = gameState.players.find(p => p.socketId === socketId1);
  const player2 = gameState.players.find(p => p.socketId === socketId2);

  if (!player1 || !player2) {
    throw new Error('One or both players not found');
  }

  if (player1.partnerId || player2.partnerId) {
    throw new Error('One or both players already paired');
  }

  const teamId = roomCodeGenerator.generateTeamCode();
  player1.partnerId = socketId2;
  player1.teamId = teamId;
  player2.partnerId = socketId1;
  player2.teamId = teamId;

  gameState.teams.push({
    teamId,
    player1Id: socketId1,
    player2Id: socketId2,
    score: 0
  });

  console.log(`Players paired: ${player1.name} & ${player2.name}`);
}

// Unpair players (break up a team)
function unpairPlayers(roomCode, socketId) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) return;

  const player = gameState.players.find(p => p.socketId === socketId);
  if (!player || !player.partnerId) return;

  const partner = gameState.players.find(p => p.socketId === player.partnerId);
  const teamId = player.teamId;

  // Clear partnership
  player.partnerId = null;
  player.teamId = null;
  if (partner) {
    partner.partnerId = null;
    partner.teamId = null;
  }

  // Remove team
  const teamIndex = gameState.teams.findIndex(t => t.teamId === teamId);
  if (teamIndex !== -1) {
    gameState.teams.splice(teamIndex, 1);
  }

  console.log(`Players unpaired: ${player.name}${partner ? ' & ' + partner.name : ''}`);
}

// Start the game (move from lobby to playing)
function startGame(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  if (gameState.status !== 'lobby') {
    throw new Error('Game already started');
  }

  if (gameState.teams.length === 0) {
    throw new Error('No teams formed');
  }

  gameState.status = 'playing';
  console.log('Game started');
}

// End the game
function endGame(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  if (gameState.status === 'lobby') {
    throw new Error('Cannot end game that has not started');
  }

  if (gameState.status === 'ended') {
    throw new Error('Game already ended');
  }

  gameState.status = 'ended';
  console.log('Game ended');
}

// Start a new round
function startRound(roomCode, question, variant = 'open_ended', options = null, answerForBoth = false) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  // Validation
  if (!['open_ended', 'multiple_choice', 'binary'].includes(variant)) {
    throw new Error('Invalid variant type');
  }

  if (variant === 'multiple_choice') {
    if (!options || !Array.isArray(options) || options.length < 2 || options.length > 4) {
      throw new Error('Multiple choice requires 2-4 options');
    }
  }

  if (variant === 'binary') {
    if (!options || !Array.isArray(options) || options.length !== 2) {
      throw new Error('Binary requires exactly 2 options');
    }
  }

  if (variant === 'open_ended' && options !== null) {
    throw new Error('Open ended should not have options');
  }

  const roundNumber = gameState.currentRound ? gameState.currentRound.roundNumber + 1 : 1;

  gameState.currentRound = {
    roundNumber,
    roundId: null, // Will be set after DB persistence
    question,
    variant,
    options,
    answerForBoth, // When true, players answer for both themselves and their partner
    status: 'answering',
    answers: {},
    submittedInCurrentPhase: [], // Track who has submitted in THIS answering session
    createdAt: Date.now() // Timestamp for response time calculation (survives reconnection)
  };

  console.log(`Round ${roundNumber} started: ${question} (${variant})`);
}

// Submit an answer
function submitAnswer(roomCode, socketId, answerText, responseTime = -1) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) {
    throw new Error('No active round');
  }

  if (gameState.currentRound.status !== 'answering') {
    throw new Error('Round not accepting answers');
  }

  // Validate answer is not empty
  if (!answerText || answerText.trim() === '') {
    throw new Error('Answer cannot be empty');
  }

  // Find the player submitting this answer
  const player = gameState.players.find(p => p.socketId === socketId);
  if (!player) {
    throw new Error('Player not found');
  }

  // Store answer object with text and response time by player name (stable across reconnections)
  gameState.currentRound.answers[player.name] = {
    text: answerText,
    responseTime: responseTime
  };

  // Accumulate team's total response time (only count positive response times)
  if (player.teamId && responseTime > 0) {
    if (!gameState.teamTotalResponseTimes[player.teamId]) {
      gameState.teamTotalResponseTimes[player.teamId] = 0;
    }
    gameState.teamTotalResponseTimes[player.teamId] += responseTime;
  }

  // Mark player as having submitted in the current answering phase (avoid duplicates)
  if (!gameState.currentRound.submittedInCurrentPhase.includes(player.name)) {
    gameState.currentRound.submittedInCurrentPhase.push(player.name);
  }

  console.log(`Answer submitted by ${player.name} (${responseTime}ms)`);
}

// Check if round is complete (all players answered)
function isRoundComplete(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) return false;

  const connectedPlayers = gameState.players.filter(p => p.connected);

  // Check if all connected players have submitted in the CURRENT answering phase
  const submittedCount = connectedPlayers.filter(p =>
    gameState.currentRound.submittedInCurrentPhase.includes(p.name)
  ).length;

  return submittedCount === connectedPlayers.length;
}

// Mark round as complete
function completeRound(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) {
    throw new Error('No active round');
  }

  gameState.currentRound.status = 'complete';
  gameState.status = 'scoring';
  console.log(`Round ${gameState.currentRound.roundNumber} complete`);
}

// Update team score
function updateTeamScore(roomCode, teamId, points) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  const team = gameState.teams.find(t => t.teamId === teamId);
  if (!team) {
    throw new Error('Team not found');
  }

  team.score += points;
  console.log(`Team ${teamId} score updated: +${points} (total: ${team.score})`);
}

// Get current game state
function getGameState(roomCode) {
  return gameStates.get(roomCode);
}

// Get player teams with full info for scoring UI
function getPlayerTeams(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) return [];

  return gameState.teams.map(team => {
    const player1 = gameState.players.find(p => p.socketId === team.player1Id);
    const player2 = gameState.players.find(p => p.socketId === team.player2Id);

    return {
      teamId: team.teamId,
      score: team.score,
      player1: {
        socketId: player1.socketId,
        name: player1.name,
        answer: gameState.currentRound?.answers[player1.name] || null
      },
      player2: {
        socketId: player2.socketId,
        name: player2.name,
        answer: gameState.currentRound?.answers[player2.name] || null
      }
    };
  });
}

// Set round ID after DB persistence
function setCurrentRoundId(roomCode, roundId) {
  const gameState = gameStates.get(roomCode);
  if (gameState && gameState.currentRound) {
    gameState.currentRound.roundId = roundId;
  }
}

// Reset to playing status (after scoring)
function returnToPlaying(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (gameState) {
    gameState.status = 'playing';
    gameState.currentRound = null; // Clear previous round data
  }
}

// Return to answering phase (from scoring)
function returnToAnswering(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  if (!gameState.currentRound) {
    throw new Error('No active round');
  }

  // Return game status to playing
  gameState.status = 'playing';

  // Return round status to answering
  gameState.currentRound.status = 'answering';

  // Clear submission tracking - players must submit again to complete the round
  // (but keep their previous answers for pre-filling)
  gameState.currentRound.submittedInCurrentPhase = [];

  console.log('Returned to answering phase - submission tracking reset');
}

// Room management functions
function hasRoom(roomCode) {
  return gameStates.has(roomCode);
}

function deleteRoom(roomCode) {
  gameStates.delete(roomCode);
  roomCodeGenerator.markRoomInactive(roomCode);
  console.log(`Room deleted: ${roomCode}`);
}

function getRoomCodes() {
  return Array.from(gameStates.keys());
}

// Get all active games (not ended)
function getAllGames() {
  const games = [];
  for (const [roomCode, state] of gameStates.entries()) {
    if (state.status !== 'ended') {
      games.push(state);
    }
  }
  return games;
}

// Randomize a player's avatar
function randomizePlayerAvatar(roomCode, socketId) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  // Check if it's the host
  if (gameState.host && gameState.host.socketId === socketId) {
    gameState.host.avatar = generateRandomAvatar();
    return gameState.host.avatar;
  }

  const player = gameState.players.find(p => p.socketId === socketId);
  if (!player) {
    throw new Error('Player not found');
  }

  player.avatar = generateRandomAvatar();
  return player.avatar;
}

module.exports = {
  initializeGame,
  addPlayer,
  removePlayer,
  disconnectPlayer,
  reconnectPlayer,
  disconnectHost,
  reconnectHost,
  getDisconnectedPlayers,
  canJoinAsNew,
  pairPlayers,
  unpairPlayers,
  startGame,
  endGame,
  startRound,
  submitAnswer,
  isRoundComplete,
  completeRound,
  updateTeamScore,
  getGameState,
  getPlayerTeams,
  setCurrentRoundId,
  returnToPlaying,
  returnToAnswering,
  hasRoom,
  deleteRoom,
  getRoomCodes,
  getAllGames,
  randomizePlayerAvatar
};
