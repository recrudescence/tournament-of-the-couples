/**
 * Round State Machine
 *
 * Manages round state transitions with validation and side effects.
 * Ensures consistent state management across the game lifecycle.
 */

const gameState = require('./gameState');

// Mirror of src/types/round-state.ts RoundState enum
const RoundState = {
  IDLE: 'idle',
  REVEAL_CHAPTER: 'reveal_chapter',
  REVEAL_VARIANT: 'reveal_variant',
  ANSWERING: 'answering',
  SELECTING: 'selecting',
  SCORING: 'scoring',
  COMPLETE: 'complete',
};

// Mirror of src/types/round-state.ts RoundAction enum
const RoundAction = {
  REVEAL_CHAPTER: 'reveal_chapter',
  REVEAL_VARIANT: 'reveal_variant',
  START_ANSWERING: 'start_answering',
  START_SELECTING: 'start_selecting',
  START_SCORING: 'start_scoring',
  REOPEN_ANSWERING: 'reopen_answering',
  COMPLETE_ROUND: 'complete_round',
  NEXT_ROUND: 'next_round',
  RESET_QUESTION: 'reset_question',
  RESTART_QUESTION: 'restart_question',
  PREVIOUS_QUESTION: 'previous_question',
  SKIP_QUESTION: 'skip_question',
};

// Valid state transitions
const VALID_TRANSITIONS = {
  [RoundState.IDLE]: {
    [RoundAction.REVEAL_CHAPTER]: RoundState.REVEAL_CHAPTER,
    [RoundAction.REVEAL_VARIANT]: RoundState.REVEAL_VARIANT,
    [RoundAction.START_ANSWERING]: RoundState.ANSWERING,
    [RoundAction.PREVIOUS_QUESTION]: RoundState.IDLE,
    [RoundAction.SKIP_QUESTION]: RoundState.IDLE,
  },
  [RoundState.REVEAL_CHAPTER]: {
    [RoundAction.REVEAL_VARIANT]: RoundState.REVEAL_VARIANT,
    [RoundAction.PREVIOUS_QUESTION]: RoundState.REVEAL_CHAPTER,
    [RoundAction.SKIP_QUESTION]: RoundState.REVEAL_CHAPTER,
  },
  [RoundState.REVEAL_VARIANT]: {
    [RoundAction.START_ANSWERING]: RoundState.ANSWERING,
    [RoundAction.PREVIOUS_QUESTION]: RoundState.REVEAL_CHAPTER,
    [RoundAction.SKIP_QUESTION]: RoundState.REVEAL_CHAPTER,
  },
  [RoundState.ANSWERING]: {
    [RoundAction.START_SELECTING]: RoundState.SELECTING,
    [RoundAction.START_SCORING]: RoundState.SCORING,
    [RoundAction.RESET_QUESTION]: RoundState.IDLE,
    [RoundAction.RESTART_QUESTION]: RoundState.REVEAL_CHAPTER,
    [RoundAction.PREVIOUS_QUESTION]: RoundState.REVEAL_CHAPTER,
    [RoundAction.SKIP_QUESTION]: RoundState.REVEAL_CHAPTER,
  },
  [RoundState.SELECTING]: {
    [RoundAction.START_SCORING]: RoundState.SCORING,
    [RoundAction.RESET_QUESTION]: RoundState.IDLE,
    [RoundAction.RESTART_QUESTION]: RoundState.REVEAL_CHAPTER,
  },
  [RoundState.SCORING]: {
    [RoundAction.REOPEN_ANSWERING]: RoundState.ANSWERING,
    [RoundAction.COMPLETE_ROUND]: RoundState.COMPLETE,
    [RoundAction.RESET_QUESTION]: RoundState.IDLE,
    [RoundAction.RESTART_QUESTION]: RoundState.REVEAL_CHAPTER,
    [RoundAction.PREVIOUS_QUESTION]: RoundState.REVEAL_CHAPTER,
    [RoundAction.SKIP_QUESTION]: RoundState.REVEAL_CHAPTER,
  },
  [RoundState.COMPLETE]: {
    [RoundAction.NEXT_ROUND]: RoundState.IDLE,
  },
};

/**
 * Derive current RoundState from game state
 */
function getCurrentState(roomCode) {
  const state = gameState.getGameState(roomCode);
  if (!state) {
    return null;
  }

  // Check for stored roundState first (most accurate after transitions)
  if (state.currentRound?.roundState) {
    return state.currentRound.roundState;
  }

  // Derive from existing status fields (backwards compatibility)
  if (!state.currentRound) {
    return RoundState.IDLE;
  }

  const roundStatus = state.currentRound.status;

  if (roundStatus === 'answering') {
    return RoundState.ANSWERING;
  }

  if (roundStatus === 'selecting') {
    return RoundState.SELECTING;
  }

  if (roundStatus === 'complete' || state.status === 'scoring') {
    return RoundState.SCORING;
  }

  return RoundState.IDLE;
}

/**
 * Check if a transition is valid from the current state
 */
function canTransition(roomCode, action) {
  const currentState = getCurrentState(roomCode);
  if (!currentState) {
    return false;
  }

  const validActions = VALID_TRANSITIONS[currentState];
  if (!validActions || !validActions[action]) {
    return false;
  }

  // Additional precondition checks
  const state = gameState.getGameState(roomCode);

  switch (action) {
    case RoundAction.RESET_QUESTION:
      // Reset is only for manual mode (no imported questions)
      return !state.importedQuestions;

    case RoundAction.RESTART_QUESTION:
    case RoundAction.PREVIOUS_QUESTION:
    case RoundAction.SKIP_QUESTION:
      // These actions require imported questions mode
      return Boolean(state.importedQuestions);

    case RoundAction.START_SELECTING:
      // Pool selection only
      return state.currentRound?.variant === 'pool_selection';

    default:
      return true;
  }
}

/**
 * Get the target state for a transition (for validation)
 */
function getTargetState(roomCode, action) {
  const currentState = getCurrentState(roomCode);
  if (!currentState) {
    return null;
  }

  const validActions = VALID_TRANSITIONS[currentState];
  return validActions?.[action] || null;
}

/**
 * Check if cursor can retreat (not at first question)
 */
function canRetreatCursor(roomCode) {
  const state = gameState.getGameState(roomCode);
  if (!state?.importedQuestions || !state.questionCursor) {
    return false;
  }

  const cursor = state.questionCursor;
  // Can retreat if not at first question of first chapter
  return cursor.chapterIndex > 0 || cursor.questionIndex > 0;
}

/**
 * Check if cursor can advance (not at last question)
 */
function canAdvanceCursor(roomCode) {
  const state = gameState.getGameState(roomCode);
  if (!state?.importedQuestions || !state.questionCursor) {
    // If no cursor yet, we can advance to start
    return Boolean(state?.importedQuestions);
  }

  const cursor = state.questionCursor;
  const chapters = state.importedQuestions.chapters;
  const currentChapter = chapters[cursor.chapterIndex];

  // Check if there are more questions
  const isLastChapter = cursor.chapterIndex === chapters.length - 1;
  const isLastQuestionInChapter = cursor.questionIndex === currentChapter.questions.length - 1;

  return !(isLastChapter && isLastQuestionInChapter);
}

/**
 * Check if any answers have been submitted in the current round
 */
function hasSubmittedAnswers(roomCode) {
  const state = gameState.getGameState(roomCode);
  if (!state?.currentRound) {
    return false;
  }

  return Object.keys(state.currentRound.answers).length > 0;
}

module.exports = {
  RoundState,
  RoundAction,
  VALID_TRANSITIONS,
  getCurrentState,
  canTransition,
  getTargetState,
  canRetreatCursor,
  canAdvanceCursor,
  hasSubmittedAnswers,
};
