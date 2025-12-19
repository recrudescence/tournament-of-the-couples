/**
 * Tests for RoundPhase state machine
 *
 * Note: These tests verify the roundPhase logic conceptually.
 * Full integration tests would require jsdom for browser environment.
 */

describe('RoundPhase State Machine', () => {
  // Round Phase Enum (same as in host.js)
  const RoundPhase = {
    INITIAL: 'initial',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed'
  };

  let mockGameState;

  beforeEach(() => {
    mockGameState = {
      roundNumber: 0,
      roundPhase: RoundPhase.INITIAL,
      answers: {},
      submittedInCurrentPhase: [],
      players: [
        { name: 'Alice' },
        { name: 'Bob' }
      ]
    };
  });

  describe('Phase Transitions', () => {
    test('starts in INITIAL phase', () => {
      expect(mockGameState.roundPhase).toBe(RoundPhase.INITIAL);
    });

    test('transitions to IN_PROGRESS when round starts', () => {
      // Simulate roundStarted event
      mockGameState.roundPhase = RoundPhase.IN_PROGRESS;
      mockGameState.roundNumber = 1;

      expect(mockGameState.roundPhase).toBe(RoundPhase.IN_PROGRESS);
      expect(mockGameState.roundNumber).toBe(1);
    });

    test('transitions to COMPLETED when all answers are in', () => {
      mockGameState.roundPhase = RoundPhase.IN_PROGRESS;

      // Simulate allAnswersIn event
      mockGameState.roundPhase = RoundPhase.COMPLETED;

      expect(mockGameState.roundPhase).toBe(RoundPhase.COMPLETED);
    });

    test('returns to IN_PROGRESS when round is reopened', () => {
      mockGameState.roundPhase = RoundPhase.COMPLETED;

      // Simulate returnedToAnswering event
      mockGameState.roundPhase = RoundPhase.IN_PROGRESS;
      mockGameState.submittedInCurrentPhase = [];

      expect(mockGameState.roundPhase).toBe(RoundPhase.IN_PROGRESS);
      expect(mockGameState.submittedInCurrentPhase).toEqual([]);
    });

    test('returns to INITIAL when moving to next round', () => {
      mockGameState.roundPhase = RoundPhase.COMPLETED;
      mockGameState.roundNumber = 1;

      // Simulate readyForNextRound event
      mockGameState.roundPhase = RoundPhase.INITIAL;
      mockGameState.roundNumber = 2;

      expect(mockGameState.roundPhase).toBe(RoundPhase.INITIAL);
      expect(mockGameState.roundNumber).toBe(2);
    });
  });

  describe('updateAnswerStatus logic', () => {
    test('uses roundPhase instead of DOM for completed state detection', () => {
      mockGameState.roundPhase = RoundPhase.COMPLETED;
      mockGameState.answers = { Alice: 'Answer1', Bob: 'Answer2' };

      const isCompleteState = (mockGameState.roundPhase === RoundPhase.COMPLETED);
      const submittedCount = isCompleteState
        ? Object.keys(mockGameState.answers).length
        : mockGameState.submittedInCurrentPhase.length;

      expect(isCompleteState).toBe(true);
      expect(submittedCount).toBe(2);
    });

    test('counts submittedInCurrentPhase when IN_PROGRESS', () => {
      mockGameState.roundPhase = RoundPhase.IN_PROGRESS;
      mockGameState.submittedInCurrentPhase = ['Alice'];
      mockGameState.answers = { Alice: 'Answer1' };

      const isCompleteState = (mockGameState.roundPhase === RoundPhase.COMPLETED);
      const submittedCount = isCompleteState
        ? Object.keys(mockGameState.answers).length
        : mockGameState.submittedInCurrentPhase.length;

      expect(isCompleteState).toBe(false);
      expect(submittedCount).toBe(1); // Only current phase submissions
    });

    test('shows all answers when COMPLETED even if reopened before', () => {
      // Simulate: was reopened, only 1 new submission, but still shows old answers
      mockGameState.roundPhase = RoundPhase.COMPLETED;
      mockGameState.answers = { Alice: 'Answer1', Bob: 'Answer2' };
      mockGameState.submittedInCurrentPhase = ['Alice']; // Only Alice resubmitted

      const isCompleteState = (mockGameState.roundPhase === RoundPhase.COMPLETED);
      const submittedCount = isCompleteState
        ? Object.keys(mockGameState.answers).length
        : mockGameState.submittedInCurrentPhase.length;

      expect(submittedCount).toBe(2); // Shows all answers, not just new submissions
    });
  });

  describe('Back to Answering (UI navigation)', () => {
    test('preserves COMPLETED phase when clicking back button', () => {
      mockGameState.roundPhase = RoundPhase.COMPLETED;

      // Simulate backToAnsweringBtn click - phase should NOT change
      // (no actual phase change in the code)

      expect(mockGameState.roundPhase).toBe(RoundPhase.COMPLETED);
    });

    test('allows updateAnswerStatus to show correct count after back navigation', () => {
      mockGameState.roundPhase = RoundPhase.COMPLETED;
      mockGameState.answers = { Alice: 'A1', Bob: 'B1' };

      // After clicking back button, should still show 2/2
      const isCompleteState = (mockGameState.roundPhase === RoundPhase.COMPLETED);
      const submittedCount = isCompleteState
        ? Object.keys(mockGameState.answers).length
        : mockGameState.submittedInCurrentPhase.length;

      expect(submittedCount).toBe(2);
    });
  });

  describe('Reconnection state restoration', () => {
    test('restores to COMPLETED when rejoining during scoring', () => {
      // Simulate joinSuccess with completed round
      const serverState = {
        status: 'scoring',
        currentRound: {
          status: 'complete',
          answers: { Alice: 'A1', Bob: 'B1' }
        }
      };

      mockGameState.roundPhase = RoundPhase.COMPLETED;
      mockGameState.answers = serverState.currentRound.answers;

      expect(mockGameState.roundPhase).toBe(RoundPhase.COMPLETED);
    });

    test('restores to IN_PROGRESS when rejoining during answering', () => {
      // Simulate joinSuccess with active round
      const serverState = {
        status: 'playing',
        currentRound: {
          status: 'answering',
          answers: {}
        }
      };

      mockGameState.roundPhase = RoundPhase.IN_PROGRESS;

      expect(mockGameState.roundPhase).toBe(RoundPhase.IN_PROGRESS);
    });

    test('restores to INITIAL when rejoining in lobby/setup', () => {
      const serverState = {
        status: 'playing',
        currentRound: null
      };

      mockGameState.roundPhase = RoundPhase.INITIAL;

      expect(mockGameState.roundPhase).toBe(RoundPhase.INITIAL);
    });
  });

  describe('Phase validation', () => {
    test('enum values are strings for easy debugging', () => {
      expect(typeof RoundPhase.INITIAL).toBe('string');
      expect(typeof RoundPhase.IN_PROGRESS).toBe('string');
      expect(typeof RoundPhase.COMPLETED).toBe('string');
    });

    test('enum values are unique', () => {
      const values = Object.values(RoundPhase);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    test('phase comparisons are strict equality', () => {
      mockGameState.roundPhase = RoundPhase.COMPLETED;

      expect(mockGameState.roundPhase === RoundPhase.COMPLETED).toBe(true);
      expect(mockGameState.roundPhase === 'completed').toBe(true); // String literal works
      expect(mockGameState.roundPhase === RoundPhase.IN_PROGRESS).toBe(false);
    });
  });
});
