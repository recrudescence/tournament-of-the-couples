const roomCodeGenerator = require('./roomCodeGenerator');

// Logging helper - silent in test environment
const log = process.env.NODE_ENV === 'test' ? () => {} : console.log;

// Normalize answer text for case-insensitive comparison
function normalizeAnswer(text) {
  if (!text) return '';
  return text.toLowerCase().trim();
}

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
    lastRoundNumber: 0, // Persists across rounds for reconnection
    teamTotalResponseTimes: {}, // Cumulative response times per team (teamId -> total ms)
    importedQuestions: null, // ImportedQuestionSet | null
    questionCursor: null // { chapterIndex, questionIndex } | null
  };

  gameStates.set(roomCode, gameState);
  log('Game initialized:', roomCode);
  return gameState;
}

// Add a player or host
function addPlayer(roomCode, socketId, name, isHost = false, isBot = false) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  if (isHost) {
    gameState.host = { socketId, name, connected: true, avatar: generateRandomAvatar() };
    log(`Host added: ${name}`);
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
      avatar: generateRandomAvatar(),
      isBot
    });
    log(`Player added: ${name}`);
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
  log(`Player removed: ${player.name}`);
}

// Mark player as disconnected (during game)
function disconnectPlayer(roomCode, socketId) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) return;

  const player = gameState.players.find(p => p.socketId === socketId);
  if (player) {
    player.connected = false;
    log(`<${player.name}> disconnected`);
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

  log(`<${name}> rejoined`);
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
  log(`<${gameState.host.name}> (host) disconnected`);
}

// Reconnect the host
function reconnectHost(roomCode, newSocketId) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.host) {
    throw new Error('Host not found');
  }

  gameState.host.socketId = newSocketId;
  gameState.host.connected = true;
  log(`<${gameState.host.name}> (host) reconnected`);
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

  log(`Players paired: ${player1.name} & ${player2.name}`);
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

  log(`Players unpaired: ${player.name}${partner ? ' & ' + partner.name : ''}`);
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
  log('Game started');
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
  log('Game ended');
}

// Reset the game back to lobby state
function resetGame(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  if (gameState.status === 'lobby') {
    throw new Error('Game is already in lobby');
  }

  // Reset to lobby state
  gameState.status = 'lobby';
  gameState.currentRound = null;
  gameState.lastRoundNumber = 0;
  gameState.teamTotalResponseTimes = {};
  gameState.importedQuestions = null;
  gameState.questionCursor = null;

  // Reset all team scores to 0
  for (const team of gameState.teams) {
    team.score = 0;
  }

  log('Game reset to lobby');
}

// Start a new round
function startRound(roomCode, question, variant = 'open_ended', options = null, answerForBoth = false, roundNumber = null) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  // Validation
  if (!['open_ended', 'multiple_choice', 'binary', 'pool_selection'].includes(variant)) {
    throw new Error('Invalid variant type');
  }

  if (variant === 'multiple_choice') {
    if (!options || !Array.isArray(options) || options.length < 2 || options.length > 6) {
      throw new Error('Multiple choice requires 2-6 options');
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

  if (variant === 'pool_selection' && options !== null) {
    throw new Error('Pool selection should not have options');
  }

  // Use provided roundNumber (from database count) or fallback to in-memory calculation
  if (roundNumber === null) {
    roundNumber = gameState.currentRound ? gameState.currentRound.roundNumber + 1 : 1;
  }

  // Persist for reconnection (survives currentRound being cleared)
  gameState.lastRoundNumber = roundNumber;

  gameState.currentRound = {
    roundNumber,
    roundId: null, // Will be set after DB persistence
    question,
    variant,
    options,
    answerForBoth, // When true, players answer for both themselves and their partner
    status: 'answering',
    roundState: 'answering', // Unified round state for state machine
    answers: {},
    submittedInCurrentPhase: [], // Track who has submitted in THIS answering session
    createdAt: Date.now(), // Timestamp for response time calculation (survives reconnection)
    // Pool selection specific fields
    ...(variant === 'pool_selection' && { picks: {}, picksSubmitted: [], revealedPoolAnswers: [], revealedPoolPickers: {} })
  };

  log(`Round ${roundNumber} started: ${question} (${variant})`);
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

  // Validate answer is not empty (except for pool_selection which allows auto-submit of empty)
  const isPoolSelection = gameState.currentRound.variant === 'pool_selection';
  if (!isPoolSelection && (!answerText || answerText.trim() === '')) {
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

  log(`Answer submitted by ${player.name} (${responseTime}ms)`);
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
  log(`Round ${gameState.currentRound.roundNumber} complete`);
}

// Transition to selecting phase (pool selection only)
function startSelecting(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) {
    throw new Error('No active round');
  }

  if (gameState.currentRound.variant !== 'pool_selection') {
    throw new Error('Not a pool selection round');
  }

  gameState.currentRound.status = 'selecting';
  log(`Round ${gameState.currentRound.roundNumber} moved to selecting phase`);
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
  log(`Team ${teamId} score updated: +${points} (total: ${team.score})`);
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

  log('Returned to answering phase - submission tracking reset');
}

// Re-open answering for a specific player
function reopenPlayerAnswering(roomCode, playerName) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) {
    throw new Error('No active round');
  }

  // Don't allow reopening during selecting phase (pool already released)
  if (gameState.currentRound.status === 'selecting') {
    throw new Error('Cannot reopen answering after pool selection has started');
  }

  // Remove from submittedInCurrentPhase
  const idx = gameState.currentRound.submittedInCurrentPhase.indexOf(playerName);
  if (idx === -1) {
    throw new Error('Player has not submitted an answer');
  }
  gameState.currentRound.submittedInCurrentPhase.splice(idx, 1);

  // Delete their answer so they start fresh
  delete gameState.currentRound.answers[playerName];

  // Make sure round is in answering status
  gameState.currentRound.status = 'answering';
  gameState.status = 'playing';

  log(`Reopened answering for ${playerName}`);
}

// Room management functions
function hasRoom(roomCode) {
  return gameStates.has(roomCode);
}

function deleteRoom(roomCode) {
  gameStates.delete(roomCode);
  roomCodeGenerator.markRoomInactive(roomCode);
  log(`Room deleted: ${roomCode}`);
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

// Set imported questions for a game
function setImportedQuestions(roomCode, questionSet) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  gameState.importedQuestions = questionSet;
  gameState.questionCursor = null; // Reset cursor when new questions are imported
  log(`Imported ${questionSet.chapters.reduce((t, c) => t + c.questions.length, 0)} questions for ${roomCode}`);
}

// Clear imported questions
function clearImportedQuestions(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  gameState.importedQuestions = null;
  gameState.questionCursor = null;
  log(`Cleared imported questions for ${roomCode}`);
}

// Advance cursor to next question
// Returns { chapterIndex, questionIndex, question, chapter, isNewChapter, isLastQuestion } or null if exhausted
function advanceCursor(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  if (!gameState.importedQuestions) {
    throw new Error('No imported questions');
  }

  const chapters = gameState.importedQuestions.chapters;
  let cursor = gameState.questionCursor;
  let isNewChapter = false;

  if (!cursor) {
    // Start at first question
    cursor = { chapterIndex: 0, questionIndex: 0 };
    isNewChapter = true;
  } else {
    // Move to next question
    const currentChapter = chapters[cursor.chapterIndex];
    if (cursor.questionIndex + 1 < currentChapter.questions.length) {
      // Next question in same chapter
      cursor = { chapterIndex: cursor.chapterIndex, questionIndex: cursor.questionIndex + 1 };
    } else if (cursor.chapterIndex + 1 < chapters.length) {
      // First question of next chapter
      cursor = { chapterIndex: cursor.chapterIndex + 1, questionIndex: 0 };
      isNewChapter = true;
    } else {
      // No more questions
      return null;
    }
  }

  gameState.questionCursor = cursor;

  const chapter = chapters[cursor.chapterIndex];
  const question = chapter.questions[cursor.questionIndex];

  // Determine if this is the last question overall
  const isLastChapter = cursor.chapterIndex === chapters.length - 1;
  const isLastQuestionInChapter = cursor.questionIndex === chapter.questions.length - 1;
  const isLastQuestion = isLastChapter && isLastQuestionInChapter;

  log(`Advanced to Chapter ${cursor.chapterIndex + 1}, Question ${cursor.questionIndex + 1} (${isNewChapter ? 'new chapter' : 'same chapter'})`);

  return {
    chapterIndex: cursor.chapterIndex,
    questionIndex: cursor.questionIndex,
    question,
    chapter: { title: chapter.title },
    isNewChapter,
    isLastQuestion
  };
}

// Get current question from cursor position
function getCurrentQuestion(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.importedQuestions || !gameState.questionCursor) {
    return null;
  }

  const cursor = gameState.questionCursor;
  const chapters = gameState.importedQuestions.chapters;
  const chapter = chapters[cursor.chapterIndex];
  const question = chapter.questions[cursor.questionIndex];

  // Determine if this is a new chapter (first question in the chapter)
  const isNewChapter = cursor.questionIndex === 0;

  // Determine if this is the last question overall
  const isLastChapter = cursor.chapterIndex === chapters.length - 1;
  const isLastQuestionInChapter = cursor.questionIndex === chapter.questions.length - 1;
  const isLastQuestion = isLastChapter && isLastQuestionInChapter;

  return {
    chapterIndex: cursor.chapterIndex,
    questionIndex: cursor.questionIndex,
    question,
    chapter: { title: chapter.title },
    isNewChapter,
    isLastQuestion
  };
}

// ============================================================================
// POOL SELECTION FUNCTIONS
// ============================================================================

// Submit a pick for pool selection
function submitPick(roomCode, socketId, pickedAnswer) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) {
    throw new Error('No active round');
  }

  if (gameState.currentRound.variant !== 'pool_selection') {
    throw new Error('Not a pool selection round');
  }

  if (gameState.currentRound.status !== 'selecting') {
    throw new Error('Round not in selecting phase');
  }

  const player = gameState.players.find(p => p.socketId === socketId);
  if (!player) {
    throw new Error('Player not found');
  }

  // Validate player has submitted their answer
  if (!gameState.currentRound.submittedInCurrentPhase.includes(player.name)) {
    throw new Error('Must submit answer before picking');
  }

  // Validate answer exists in pool (case-insensitive)
  const normalizedPick = normalizeAnswer(pickedAnswer);
  const answerPool = Object.values(gameState.currentRound.answers).map(a => normalizeAnswer(a.text));
  if (!answerPool.includes(normalizedPick)) {
    throw new Error('Invalid pick: answer not in pool');
  }

  // Cannot pick own answer UNLESS others also wrote the same answer (case-insensitive)
  // This allows picking a duplicate answer even if you also wrote it
  const ownAnswer = gameState.currentRound.answers[player.name]?.text;
  const normalizedOwn = normalizeAnswer(ownAnswer);

  if (normalizedPick === normalizedOwn) {
    // Count how many people wrote this same answer (case-insensitive)
    const matchingAnswers = Object.values(gameState.currentRound.answers)
      .filter(a => normalizeAnswer(a.text) === normalizedPick);

    if (matchingAnswers.length <= 1) {
      // Only the player themselves wrote this answer - can't pick it
      throw new Error('Cannot pick your own answer');
    }
    // Multiple people wrote the same answer, allow picking it
  }

  // Store pick
  gameState.currentRound.picks[player.name] = pickedAnswer;
  if (!gameState.currentRound.picksSubmitted.includes(player.name)) {
    gameState.currentRound.picksSubmitted.push(player.name);
  }

  log(`Pick submitted by ${player.name}: "${pickedAnswer}"`);
}

// Check if all connected players have submitted picks
function areAllPicksIn(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) return false;
  if (gameState.currentRound.variant !== 'pool_selection') return false;

  const connectedPlayers = gameState.players.filter(p => p.connected);
  const picksCount = connectedPlayers.filter(p =>
    gameState.currentRound.picksSubmitted.includes(p.name)
  ).length;

  return picksCount === connectedPlayers.length;
}

// Get shuffled answer pool with player identity (for "yours" label)
// If pool already exists in currentRound, return it (for reconnection consistency)
// Otherwise generate, store, and return a new shuffled pool
function getAnswerPool(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) return [];

  // Return existing pool if already generated (ensures consistency on reconnect)
  if (gameState.currentRound.answerPool) {
    return gameState.currentRound.answerPool;
  }

  // Build array with player names (for identity) and answer text
  const answers = Object.entries(gameState.currentRound.answers).map(([playerName, a]) => ({
    playerName,
    answer: a.text
  }));

  // Fisher-Yates shuffle
  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }

  // Store the shuffled pool for reconnection consistency
  gameState.currentRound.answerPool = answers;

  return answers;
}

// Get players who picked a specific answer
function getPickersForAnswer(roomCode, answerText) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) return [];

  const pickers = [];
  for (const [playerName, pickedAnswer] of Object.entries(gameState.currentRound.picks || {})) {
    if (pickedAnswer === answerText) {
      const player = gameState.players.find(p => p.name === playerName);
      if (player) pickers.push(player);
    }
  }
  return pickers;
}

// Get ALL players who wrote a specific answer text (handles duplicates, case-insensitive)
function getAuthorsOfAnswer(roomCode, answerText) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) return [];

  const normalizedSearch = normalizeAnswer(answerText);
  const authors = [];
  for (const [playerName, answer] of Object.entries(gameState.currentRound.answers || {})) {
    if (normalizeAnswer(answer.text) === normalizedSearch) {
      const player = gameState.players.find(p => p.name === playerName);
      if (player) authors.push(player);
    }
  }
  return authors;
}

// Get the first player who wrote a specific answer (for backwards compatibility)
function getAuthorOfAnswer(roomCode, answerText) {
  const authors = getAuthorsOfAnswer(roomCode, answerText);
  return authors.length > 0 ? authors[0] : null;
}

// Check if players correctly picked their partner's answer
// Returns all correct pickers and points per team (handles duplicate answers, case-insensitive)
// If both players on a team wrote the same answer and both picked correctly, the team gets 2 points
function checkCorrectPick(roomCode, answerText) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) return { correctPickers: [], teamIds: [], teamPoints: {} };

  const authors = getAuthorsOfAnswer(roomCode, answerText);
  if (authors.length === 0) return { correctPickers: [], teamIds: [], teamPoints: {} };

  const normalizedAnswer = normalizeAnswer(answerText);
  const correctPickers = [];
  const teamPoints = {}; // teamId -> number of points

  // For each author, check if their partner picked this answer (case-insensitive)
  for (const author of authors) {
    const partner = gameState.players.find(p => p.socketId === author.partnerId);
    if (partner) {
      // Only check picks from players who have actually submitted a pick
      const hasPartnerPicked = gameState.currentRound.picksSubmitted?.includes(partner.name);
      if (!hasPartnerPicked) continue;

      const partnerPick = gameState.currentRound.picks[partner.name];
      if (normalizeAnswer(partnerPick) === normalizedAnswer) {
        correctPickers.push(partner);
        if (author.teamId) {
          // Increment points for this team (multiple correct picks = multiple points)
          teamPoints[author.teamId] = (teamPoints[author.teamId] || 0) + 1;
        }
      }
    }
  }

  const teamIds = Object.keys(teamPoints);

  return {
    correctPickers,
    teamIds,
    teamPoints, // teamId -> points earned
    // Keep teamId for backwards compatibility (first team)
    teamId: teamIds.length > 0 ? teamIds[0] : null
  };
}

// Check if a pool answer has already been revealed (prevents duplicate point awards)
// Uses normalized comparison so "Water" and "water" are treated as the same
function isPoolAnswerRevealed(roomCode, answerText) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) return false;

  const revealed = gameState.currentRound.revealedPoolAnswers || [];
  const normalizedSearch = normalizeAnswer(answerText);
  return revealed.some(r => normalizeAnswer(r) === normalizedSearch);
}

// Mark a pool answer as revealed (stores normalized version)
function markPoolAnswerRevealed(roomCode, answerText) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) return;

  if (!gameState.currentRound.revealedPoolAnswers) {
    gameState.currentRound.revealedPoolAnswers = [];
  }

  const normalized = normalizeAnswer(answerText);
  const alreadyRevealed = gameState.currentRound.revealedPoolAnswers
    .some(r => normalizeAnswer(r) === normalized);

  if (!alreadyRevealed) {
    gameState.currentRound.revealedPoolAnswers.push(answerText);
  }
}

// Store revealed pickers for an answer (for reconnection)
// Uses normalized key so all case variations map to the same pickers
function markPoolPickersRevealed(roomCode, answerText, pickers) {
  const gameState = gameStates.get(roomCode);
  if (!gameState || !gameState.currentRound) return;

  if (!gameState.currentRound.revealedPoolPickers) {
    gameState.currentRound.revealedPoolPickers = {};
  }

  const normalized = normalizeAnswer(answerText);
  gameState.currentRound.revealedPoolPickers[normalized] = pickers;
}

// ============================================================================
// CURSOR MANIPULATION FUNCTIONS
// ============================================================================

// Retreat cursor to previous question
// Returns cursor data like advanceCursor, or null if at first question
function retreatCursor(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  if (!gameState.importedQuestions) {
    throw new Error('No imported questions');
  }

  let cursor = gameState.questionCursor;
  const chapters = gameState.importedQuestions.chapters;

  if (!cursor) {
    throw new Error('Cursor not initialized');
  }

  let isNewChapter = false;

  if (cursor.questionIndex > 0) {
    // Previous question in same chapter
    cursor = { chapterIndex: cursor.chapterIndex, questionIndex: cursor.questionIndex - 1 };
  } else if (cursor.chapterIndex > 0) {
    // Last question of previous chapter
    const prevChapter = chapters[cursor.chapterIndex - 1];
    cursor = { chapterIndex: cursor.chapterIndex - 1, questionIndex: prevChapter.questions.length - 1 };
    isNewChapter = true; // Entering a different chapter
  } else {
    // Already at first question
    return null;
  }

  gameState.questionCursor = cursor;

  const chapter = chapters[cursor.chapterIndex];
  const question = chapter.questions[cursor.questionIndex];

  // Determine if this is the last question overall
  const isLastChapter = cursor.chapterIndex === chapters.length - 1;
  const isLastQuestionInChapter = cursor.questionIndex === chapter.questions.length - 1;
  const isLastQuestion = isLastChapter && isLastQuestionInChapter;

  log(`Retreated to Chapter ${cursor.chapterIndex + 1}, Question ${cursor.questionIndex + 1}`);

  return {
    chapterIndex: cursor.chapterIndex,
    questionIndex: cursor.questionIndex,
    question,
    chapter: { title: chapter.title },
    isNewChapter,
    isLastQuestion
  };
}

// Set cursor to an arbitrary position
function setCursor(roomCode, chapterIndex, questionIndex) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  if (!gameState.importedQuestions) {
    throw new Error('No imported questions');
  }

  const chapters = gameState.importedQuestions.chapters;

  // Validate position
  if (chapterIndex < 0 || chapterIndex >= chapters.length) {
    throw new Error('Invalid chapter index');
  }

  const chapter = chapters[chapterIndex];
  if (questionIndex < 0 || questionIndex >= chapter.questions.length) {
    throw new Error('Invalid question index');
  }

  const oldCursor = gameState.questionCursor;
  const isNewChapter = !oldCursor || oldCursor.chapterIndex !== chapterIndex;

  gameState.questionCursor = { chapterIndex, questionIndex };

  const question = chapter.questions[questionIndex];

  // Determine if this is the last question overall
  const isLastChapter = chapterIndex === chapters.length - 1;
  const isLastQuestionInChapter = questionIndex === chapter.questions.length - 1;
  const isLastQuestion = isLastChapter && isLastQuestionInChapter;

  log(`Set cursor to Chapter ${chapterIndex + 1}, Question ${questionIndex + 1}`);

  return {
    chapterIndex,
    questionIndex,
    question,
    chapter: { title: chapter.title },
    isNewChapter,
    isLastQuestion
  };
}

// Clear current round data for reset/restart
// Preserves cursor position, clears round state
function clearCurrentRound(roomCode) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  gameState.currentRound = null;
  gameState.status = 'playing';

  log('Current round cleared');
}

// Set the round state (for state machine transitions)
function setRoundState(roomCode, roundState) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    throw new Error('Game not initialized');
  }

  if (gameState.currentRound) {
    gameState.currentRound.roundState = roundState;
  }

  log(`Round state set to: ${roundState}`);
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
  resetGame,
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
  reopenPlayerAnswering,
  hasRoom,
  deleteRoom,
  getRoomCodes,
  getAllGames,
  randomizePlayerAvatar,
  setImportedQuestions,
  clearImportedQuestions,
  advanceCursor,
  getCurrentQuestion,
  // Pool selection
  startSelecting,
  submitPick,
  areAllPicksIn,
  getAnswerPool,
  getPickersForAnswer,
  getAuthorsOfAnswer,
  getAuthorOfAnswer,
  checkCorrectPick,
  isPoolAnswerRevealed,
  markPoolAnswerRevealed,
  markPoolPickersRevealed,
  // Cursor manipulation (for host controls)
  retreatCursor,
  setCursor,
  clearCurrentRound,
  setRoundState,
};
