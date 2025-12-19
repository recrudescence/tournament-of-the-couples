const { generate } = require('random-words');

// Track active room codes to prevent collisions
const activeRooms = new Set();

/**
 * Generate a unique 4-letter room code
 * @returns {string} - Lowercase 4-letter room code
 */
function generateRoomCode() {
  let code;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    // Generate random 4-letter word, lowercase
    const words = generate({ exactly: 1, maxLength: 4, minLength: 4 });
    code = words[0].toLowerCase();
    attempts++;

    if (attempts >= maxAttempts) {
      throw new Error('Unable to generate unique room code after 100 attempts');
    }
  } while (activeRooms.has(code));

  activeRooms.add(code);
  return code;
}

/**
 * Generate a 4-letter team code
 * Teams don't need global uniqueness tracking, just local uniqueness per game
 * @returns {string} - Lowercase 4-letter team code
 */
function generateTeamCode() {
  const words = generate({ exactly: 1, maxLength: 4, minLength: 4 });
  return words[0].toLowerCase();
}

/**
 * Validate that a room code is in the correct format
 * @param {string} code - Code to validate
 * @returns {boolean} - True if valid format
 */
function validateRoomCode(code) {
  return typeof code === 'string' &&
         code.length === 4 &&
         /^[a-z]+$/.test(code);
}

/**
 * Mark a room as inactive and remove from tracking
 * @param {string} code - Room code to deactivate
 */
function markRoomInactive(code) {
  activeRooms.delete(code);
}

/**
 * Check if a room code is currently active
 * @param {string} code - Room code to check
 * @returns {boolean} - True if room is active
 */
function isRoomActive(code) {
  return activeRooms.has(code);
}

module.exports = {
  generateRoomCode,
  generateTeamCode,
  validateRoomCode,
  markRoomInactive,
  isRoomActive
};
