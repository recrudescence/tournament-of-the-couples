const { v4: uuidv4 } = require('uuid');

// In-memory game state
let gameState = null;

// Initialize a new game
function initializeGame() {
  gameState = {
    gameId: uuidv4(),
    status: 'lobby', // 'lobby' | 'playing' | 'scoring' | 'ended'
    host: null,
    players: [],
    teams: [],
    currentRound: null
  };
  console.log('Game initialized:', gameState.gameId);
  return gameState;
}

// Add a player or host
function addPlayer(socketId, name, isHost = false) {
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  if (isHost) {
    gameState.host = { socketId, name };
    console.log(`Host added: ${name}`);
  } else {
    // Check if player name already exists
    const existing = gameState.players.find(p => p.name === name);
    if (existing) {
      throw new Error('Player name already exists');
    }

    gameState.players.push({
      socketId,
      name,
      partnerId: null,
      teamId: null,
      connected: true
    });
    console.log(`Player added: ${name}`);
  }
}

// Remove a player (only used in lobby)
function removePlayer(socketId) {
  if (!gameState) return;

  const playerIndex = gameState.players.findIndex(p => p.socketId === socketId);
  if (playerIndex === -1) return;

  const player = gameState.players[playerIndex];
  
  // If player was paired, unpair them first
  if (player.partnerId) {
    unpairPlayers(socketId);
  }

  gameState.players.splice(playerIndex, 1);
  console.log(`Player removed: ${player.name}`);
}

// Mark player as disconnected (during game)
function disconnectPlayer(socketId) {
  if (!gameState) return;

  const player = gameState.players.find(p => p.socketId === socketId);
  if (player) {
    player.connected = false;
    console.log(`<${player.name}> disconnected`);
  }
}

// Reconnect a player
function reconnectPlayer(name, newSocketId) {
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
function getDisconnectedPlayers() {
  if (!gameState) return [];
  return gameState.players
    .filter(p => !p.connected)
    .map(p => ({ name: p.name }));
}

// Check if new players can join
function canJoinAsNew() {
  return gameState && gameState.status === 'lobby';
}

// Pair two players into a team
function pairPlayers(socketId1, socketId2) {
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

  // Create team
  const teamId = uuidv4();
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
function unpairPlayers(socketId) {
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
function startGame() {
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

// Start a new round
function startRound(question) {
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  const roundNumber = gameState.currentRound ? gameState.currentRound.roundNumber + 1 : 1;

  gameState.currentRound = {
    roundNumber,
    roundId: null, // Will be set after DB persistence
    question,
    status: 'answering',
    answers: {},
    submittedInCurrentPhase: [] // Track who has submitted in THIS answering session
  };

  console.log(`Round ${roundNumber} started: ${question}`);
}

// Submit an answer
function submitAnswer(socketId, answer) {
  if (!gameState || !gameState.currentRound) {
    throw new Error('No active round');
  }

  if (gameState.currentRound.status !== 'answering') {
    throw new Error('Round not accepting answers');
  }

  // Find the player submitting this answer
  const player = gameState.players.find(p => p.socketId === socketId);
  if (!player) {
    throw new Error('Player not found');
  }

  // Store answer by player name (stable across reconnections)
  gameState.currentRound.answers[player.name] = answer;

  // Mark player as having submitted in the current answering phase
  if (!gameState.currentRound.submittedInCurrentPhase.includes(player.name)) {
    gameState.currentRound.submittedInCurrentPhase.push(player.name);
  }

  console.log(`Answer submitted by ${player.name}`);
}

// Check if round is complete (all players answered)
function isRoundComplete() {
  if (!gameState || !gameState.currentRound) return false;

  const connectedPlayers = gameState.players.filter(p => p.connected);

  // Check if all connected players have submitted in the CURRENT answering phase
  const submittedCount = connectedPlayers.filter(p =>
    gameState.currentRound.submittedInCurrentPhase.includes(p.name)
  ).length;

  return submittedCount === connectedPlayers.length;
}

// Mark round as complete
function completeRound() {
  if (!gameState || !gameState.currentRound) {
    throw new Error('No active round');
  }

  gameState.currentRound.status = 'complete';
  gameState.status = 'scoring';
  console.log(`Round ${gameState.currentRound.roundNumber} complete`);
}

// Update team score
function updateTeamScore(teamId, points) {
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
function getGameState() {
  return gameState;
}

// Get player teams with full info for scoring UI
function getPlayerTeams() {
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
function setCurrentRoundId(roundId) {
  if (gameState && gameState.currentRound) {
    gameState.currentRound.roundId = roundId;
  }
}

// Reset to playing status (after scoring)
function returnToPlaying() {
  if (gameState) {
    gameState.status = 'playing';
  }
}

// Return to answering phase (from scoring)
function returnToAnswering() {
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

module.exports = {
  initializeGame,
  addPlayer,
  removePlayer,
  disconnectPlayer,
  reconnectPlayer,
  getDisconnectedPlayers,
  canJoinAsNew,
  pairPlayers,
  unpairPlayers,
  startGame,
  startRound,
  submitAnswer,
  isRoundComplete,
  completeRound,
  updateTeamScore,
  getGameState,
  getPlayerTeams,
  setCurrentRoundId,
  returnToPlaying,
  returnToAnswering
};
