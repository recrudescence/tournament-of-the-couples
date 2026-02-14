const gameState = require('./gameState');
const database = require('./database');

// Logging helper - silent in test environment
const log = process.env.NODE_ENV === 'test' ? () => {} : console.log;

// Greek god name pool
const BOT_NAMES = [
  'Apollo', 'Athena', 'Hermes', 'Artemis', 'Ares', 'Aphrodite',
  'Zeus', 'Poseidon', 'Demeter', 'Dionysus', 'Persephone', 'Hades',
  'Nike', 'Eros', 'Pan', 'Iris', 'Helios', 'Selene',
  'Atlas', 'Prometheus', 'Calypso', 'Echo', 'Hera', 'Hephaestus',
];

// Canned open-ended answers
const OPEN_ENDED_ANSWERS = [
  'Pizza', 'Sushi', 'The beach', 'Netflix', 'Tacos',
  'Sleeping in', 'Coffee', 'Ice cream', 'A good book', 'Hiking',
  'Dancing', 'Video games', 'Cooking together', 'Road trips', 'Sunsets',
  'Chocolate', 'Wine', 'Puppies', 'A warm blanket', 'Music',
  'Camping', 'Brunch', 'Traveling', 'Board games', 'Stargazing',
];

// Active bot timers per room: roomCode -> Set<timeoutId>
const botTimers = new Map();

function isBot(socketId) {
  return typeof socketId === 'string' && socketId.startsWith('bot-');
}

function getNextBotName(roomCode) {
  const state = gameState.getGameState(roomCode);
  if (!state) return null;

  // Collect all names in use (host + players)
  const usedNames = new Set();
  if (state.host) usedNames.add(state.host.name);
  state.players.forEach(p => usedNames.add(p.name));

  // Get available names and pick one randomly
  const availableNames = BOT_NAMES.filter(name => !usedNames.has(name));
  if (availableNames.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * availableNames.length);
  return availableNames[randomIndex];
}

function addBots(roomCode, count) {
  // Round up to even
  count = Math.ceil(count / 2) * 2;

  const addedNames = [];

  for (let i = 0; i < count; i++) {
    const name = getNextBotName(roomCode);
    if (!name) break; // No more names available

    const socketId = `bot-${name.toLowerCase()}`;
    gameState.addPlayer(roomCode, socketId, name, false, true);
    addedNames.push({ name, socketId });
  }

  // Auto-pair bots in order (pairs of 2)
  for (let i = 0; i < addedNames.length - 1; i += 2) {
    gameState.pairPlayers(roomCode, addedNames[i].socketId, addedNames[i + 1].socketId);
  }

  log(`Added ${addedNames.length} bots to room ${roomCode}`);
  return addedNames.map(b => b.name);
}

function removeAllBots(roomCode) {
  const state = gameState.getGameState(roomCode);
  if (!state) return;

  cancelBotTimers(roomCode);

  // Find all bot players and remove them
  const botPlayers = state.players.filter(p => isBot(p.socketId));
  for (const bot of botPlayers) {
    gameState.removePlayer(roomCode, bot.socketId);
  }

  log(`Removed ${botPlayers.length} bots from room ${roomCode}`);
}

function generateBotAnswer(round, botName, partnerName) {
  const { variant, options, answerForBoth } = round;

  // For binary questions, use actual teammate names instead of placeholder options
  const effectiveOptions = variant === 'binary'
    ? [botName, partnerName]
    : options;

  let answer;
  if (variant === 'multiple_choice' || variant === 'binary') {
    // Pick a random option
    answer = effectiveOptions[Math.floor(Math.random() * effectiveOptions.length)];
  } else {
    // Open-ended: pick from pool
    answer = OPEN_ENDED_ANSWERS[Math.floor(Math.random() * OPEN_ENDED_ANSWERS.length)];
  }

  if (answerForBoth) {
    // JSON format: answers for both self and partner
    const partnerAnswer = variant === 'open_ended'
      ? OPEN_ENDED_ANSWERS[Math.floor(Math.random() * OPEN_ENDED_ANSWERS.length)]
      : effectiveOptions[Math.floor(Math.random() * effectiveOptions.length)];
    const answerObj = {};
    answerObj[botName] = answer;
    answerObj[partnerName] = partnerAnswer;
    return JSON.stringify(answerObj);
  }

  return answer;
}

function scheduleBotAnswers(roomCode, io) {
  cancelBotTimers(roomCode);

  const state = gameState.getGameState(roomCode);
  if (!state || !state.currentRound) return;

  const timers = new Set();
  botTimers.set(roomCode, timers);

  const botPlayers = state.players.filter(p => isBot(p.socketId) && p.connected);

  for (const bot of botPlayers) {
    // Random delay 2-8 seconds
    const delay = 2000 + Math.random() * 6000;

    const timerId = setTimeout(async () => {
      timers.delete(timerId);

      try {
        const currentState = gameState.getGameState(roomCode);
        if (!currentState || !currentState.currentRound || currentState.currentRound.status !== 'answering') {
          return;
        }

        // Already submitted in this phase
        if (currentState.currentRound.submittedInCurrentPhase.includes(bot.name)) {
          return;
        }

        // Find partner name
        const partner = currentState.players.find(p => p.socketId === bot.partnerId);
        const partnerName = partner ? partner.name : 'Unknown';

        const responseTime = Math.floor(delay);
        const answer = generateBotAnswer(currentState.currentRound, bot.name, partnerName);

        gameState.submitAnswer(roomCode, bot.socketId, answer, responseTime);

        // Persist to database
        if (currentState.currentRound.roundId) {
          await database.saveAnswer(
            currentState.currentRound.roundId,
            bot.name,
            bot.teamId,
            answer,
            responseTime
          );
        }

        const updatedState = gameState.getGameState(roomCode);

        // Broadcast answer submitted
        io.to(roomCode).emit('answerSubmitted', {
          playerName: bot.name,
          answer,
          responseTime,
          submittedInCurrentPhase: updatedState.currentRound.submittedInCurrentPhase,
          gameState: updatedState,
        });

        // Check if round is complete
        if (gameState.isRoundComplete(roomCode)) {
          const state = gameState.getGameState(roomCode);
          if (state.currentRound.variant === 'pool_selection') {
            // Transition to selecting phase
            gameState.startSelecting(roomCode);
            const answerPool = gameState.getAnswerPool(roomCode);
            io.to(roomCode).emit('poolReady', {
              answers: answerPool,
              gameState: gameState.getGameState(roomCode)
            });
            // Schedule bot picks
            scheduleBotPicks(roomCode, io);
          } else {
            gameState.completeRound(roomCode);
            io.to(roomCode).emit('allAnswersIn');
          }
        }
      } catch (err) {
        console.error(`Bot answer error (${bot.name}):`, err);
      }
    }, delay);

    timers.add(timerId);
  }

  log(`Scheduled ${botPlayers.length} bot answers for room ${roomCode}`);
}

function cancelBotTimers(roomCode) {
  const timers = botTimers.get(roomCode);
  if (timers) {
    for (const timerId of timers) {
      clearTimeout(timerId);
    }
    botTimers.delete(roomCode);
  }
}

// Schedule bot picks for pool selection mode
function scheduleBotPicks(roomCode, io) {
  const state = gameState.getGameState(roomCode);
  if (!state || !state.currentRound) return;
  if (state.currentRound.variant !== 'pool_selection') return;

  // Get existing timers or create new set
  let timers = botTimers.get(roomCode);
  if (!timers) {
    timers = new Set();
    botTimers.set(roomCode, timers);
  }

  const botPlayers = state.players.filter(p => isBot(p.socketId) && p.connected);

  for (const bot of botPlayers) {
    // Random delay 1-4 seconds
    const delay = 1000 + Math.random() * 3000;

    const timerId = setTimeout(() => {
      timers.delete(timerId);

      try {
        const currentState = gameState.getGameState(roomCode);
        if (!currentState || !currentState.currentRound) {
          return;
        }

        // Already picked
        if (currentState.currentRound.picksSubmitted?.includes(bot.name)) {
          return;
        }

        // Pick a random answer that isn't their own (filter by player name, not text)
        const availableAnswers = Object.entries(currentState.currentRound.answers)
          .filter(([playerName]) => playerName !== bot.name)
          .map(([, a]) => a.text);
        if (availableAnswers.length === 0) return;

        const pickedAnswer = availableAnswers[Math.floor(Math.random() * availableAnswers.length)];

        gameState.submitPick(roomCode, bot.socketId, pickedAnswer);

        const updatedState = gameState.getGameState(roomCode);

        // Broadcast pick submitted
        io.to(roomCode).emit('pickSubmitted', {
          playerName: bot.name,
          picksSubmitted: updatedState.currentRound.picksSubmitted,
          gameState: updatedState
        });

        // Check if all picks are in
        if (gameState.areAllPicksIn(roomCode)) {
          gameState.completeRound(roomCode);
          io.to(roomCode).emit('allPicksIn');
        }
      } catch (err) {
        console.error(`Bot pick error (${bot.name}):`, err);
      }
    }, delay);

    timers.add(timerId);
  }

  log(`Scheduled ${botPlayers.length} bot picks for room ${roomCode}`);
}

module.exports = {
  isBot,
  addBots,
  removeAllBots,
  scheduleBotAnswers,
  scheduleBotPicks,
  cancelBotTimers,
  generateBotAnswer,
};
