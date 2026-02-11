/**
 * Unified Round State Machine
 *
 * States represent the current phase of a round from setup through completion.
 * Shared between server and client for consistent state management.
 */

export enum RoundState {
  /** No active round - between rounds or at question entry */
  IDLE = 'idle',
  /** Imported mode: showing chapter title */
  REVEAL_CHAPTER = 'reveal_chapter',
  /** Imported mode: showing question context/variant */
  REVEAL_VARIANT = 'reveal_variant',
  /** Players submitting answers */
  ANSWERING = 'answering',
  /** Pool selection: players picking from pool */
  SELECTING = 'selecting',
  /** Host reviewing and awarding points */
  SCORING = 'scoring',
  /** Round finished, ready for next */
  COMPLETE = 'complete',
}

/**
 * Actions that can trigger state transitions
 */
export enum RoundAction {
  /** Start revealing a new chapter (imported mode) */
  REVEAL_CHAPTER = 'reveal_chapter',
  /** Advance reveal to variant/context (imported mode) */
  REVEAL_VARIANT = 'reveal_variant',
  /** Start answering phase (manual mode start, or after reveal) */
  START_ANSWERING = 'start_answering',
  /** Transition to pool selection (pool_selection variant only) */
  START_SELECTING = 'start_selecting',
  /** Begin scoring phase */
  START_SCORING = 'start_scoring',
  /** Reopen answering from scoring */
  REOPEN_ANSWERING = 'reopen_answering',
  /** Complete the round */
  COMPLETE_ROUND = 'complete_round',
  /** Advance to next round */
  NEXT_ROUND = 'next_round',
  /** Reset question - return to IDLE (manual mode) */
  RESET_QUESTION = 'reset_question',
  /** Restart question - return to reveal (imported mode) */
  RESTART_QUESTION = 'restart_question',
  /** Previous question - retreat cursor (imported mode) */
  PREVIOUS_QUESTION = 'previous_question',
  /** Skip question - advance cursor (imported mode) */
  SKIP_QUESTION = 'skip_question',
}

/**
 * Transition table documenting valid state transitions
 * Key: from state, Value: map of action -> to state
 */
export const VALID_TRANSITIONS: Record<RoundState, Partial<Record<RoundAction, RoundState>>> = {
  [RoundState.IDLE]: {
    [RoundAction.REVEAL_CHAPTER]: RoundState.REVEAL_CHAPTER,
    [RoundAction.REVEAL_VARIANT]: RoundState.REVEAL_VARIANT,
    [RoundAction.START_ANSWERING]: RoundState.ANSWERING,
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
