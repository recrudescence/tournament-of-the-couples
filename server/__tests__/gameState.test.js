// Mock uuid before requiring gameState
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9))
}));

const gameState = require('../gameState');

describe('GameState - Array Operations for submittedInCurrentPhase', () => {
  beforeEach(() => {
    // Initialize a fresh game for each test
    gameState.initializeGame();

    // Add some test players
    gameState.addPlayer('socket1', 'Alice', false);
    gameState.addPlayer('socket2', 'Bob', false);
    gameState.addPlayer('socket3', 'Charlie', false);
    gameState.addPlayer('socket4', 'Diana', false);

    // Pair players into teams
    gameState.pairPlayers('socket1', 'socket2');
    gameState.pairPlayers('socket3', 'socket4');

    // Start the game
    gameState.startGame();
  });

  describe('startRound', () => {
    test('initializes submittedInCurrentPhase as empty array', () => {
      gameState.startRound('What is your favorite color?');

      const state = gameState.getGameState();
      expect(state.currentRound.submittedInCurrentPhase).toEqual([]);
      expect(Array.isArray(state.currentRound.submittedInCurrentPhase)).toBe(true);
    });

    test('creates new array for each round', () => {
      gameState.startRound('Round 1 question');
      const state1 = gameState.getGameState();
      const array1 = state1.currentRound.submittedInCurrentPhase;

      gameState.completeRound();
      gameState.returnToPlaying();
      gameState.startRound('Round 2 question');

      const state2 = gameState.getGameState();
      const array2 = state2.currentRound.submittedInCurrentPhase;

      // Should be different array instances
      expect(array2).not.toBe(array1);
      expect(array2).toEqual([]);
    });
  });

  describe('submitAnswer', () => {
    beforeEach(() => {
      gameState.startRound('Test question');
    });

    test('adds player name to array on first submission', () => {
      gameState.submitAnswer('socket1', 'Red');

      const state = gameState.getGameState();
      expect(state.currentRound.submittedInCurrentPhase).toEqual(['Alice']);
    });

    test('adds multiple players to array', () => {
      gameState.submitAnswer('socket1', 'Red');
      gameState.submitAnswer('socket2', 'Blue');
      gameState.submitAnswer('socket3', 'Green');

      const state = gameState.getGameState();
      expect(state.currentRound.submittedInCurrentPhase).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    test('does not add duplicate entries if same player submits twice', () => {
      gameState.submitAnswer('socket1', 'Red');
      gameState.submitAnswer('socket1', 'Blue'); // Resubmit with different answer

      const state = gameState.getGameState();
      expect(state.currentRound.submittedInCurrentPhase).toEqual(['Alice']);
      expect(state.currentRound.submittedInCurrentPhase.length).toBe(1);
    });

    test('stores answer even when duplicate prevention triggers', () => {
      gameState.submitAnswer('socket1', 'Red');
      gameState.submitAnswer('socket1', 'Blue'); // Update answer

      const state = gameState.getGameState();
      // Array has one entry
      expect(state.currentRound.submittedInCurrentPhase).toEqual(['Alice']);
      // But answer is updated
      expect(state.currentRound.answers['Alice']).toBe('Blue');
    });
  });

  describe('isRoundComplete', () => {
    beforeEach(() => {
      gameState.startRound('Test question');
    });

    test('returns false when no submissions', () => {
      expect(gameState.isRoundComplete()).toBe(false);
    });

    test('returns false when some players have not submitted', () => {
      gameState.submitAnswer('socket1', 'Answer1');
      gameState.submitAnswer('socket2', 'Answer2');
      // Charlie and Diana have not submitted

      expect(gameState.isRoundComplete()).toBe(false);
    });

    test('returns true when all connected players have submitted', () => {
      gameState.submitAnswer('socket1', 'Answer1');
      gameState.submitAnswer('socket2', 'Answer2');
      gameState.submitAnswer('socket3', 'Answer3');
      gameState.submitAnswer('socket4', 'Answer4');

      expect(gameState.isRoundComplete()).toBe(true);
    });

    test('ignores disconnected players', () => {
      // Disconnect one player
      gameState.disconnectPlayer('socket4');

      // Only need 3 submissions now
      gameState.submitAnswer('socket1', 'Answer1');
      gameState.submitAnswer('socket2', 'Answer2');
      gameState.submitAnswer('socket3', 'Answer3');

      expect(gameState.isRoundComplete()).toBe(true);
    });

    test('uses array.includes() for membership check', () => {
      gameState.submitAnswer('socket1', 'Answer1');

      const state = gameState.getGameState();
      // Verify we can use includes on the array
      expect(state.currentRound.submittedInCurrentPhase.includes('Alice')).toBe(true);
      expect(state.currentRound.submittedInCurrentPhase.includes('Bob')).toBe(false);
    });
  });

  describe('returnToAnswering', () => {
    beforeEach(() => {
      gameState.startRound('Test question');
      // Submit all answers
      gameState.submitAnswer('socket1', 'Answer1');
      gameState.submitAnswer('socket2', 'Answer2');
      gameState.submitAnswer('socket3', 'Answer3');
      gameState.submitAnswer('socket4', 'Answer4');
      gameState.completeRound();
    });

    test('clears submittedInCurrentPhase array', () => {
      const stateBefore = gameState.getGameState();
      expect(stateBefore.currentRound.submittedInCurrentPhase.length).toBe(4);

      gameState.returnToAnswering();

      const stateAfter = gameState.getGameState();
      expect(stateAfter.currentRound.submittedInCurrentPhase).toEqual([]);
    });

    test('preserves answers for pre-filling', () => {
      gameState.returnToAnswering();

      const state = gameState.getGameState();
      expect(state.currentRound.answers).toEqual({
        'Alice': 'Answer1',
        'Bob': 'Answer2',
        'Charlie': 'Answer3',
        'Diana': 'Answer4'
      });
    });

    test('allows round to be incomplete again after clearing', () => {
      gameState.returnToAnswering();

      // Round should not be complete with empty submission array
      expect(gameState.isRoundComplete()).toBe(false);
    });

    test('can accept new submissions after reopening', () => {
      gameState.returnToAnswering();

      // Alice resubmits
      gameState.submitAnswer('socket1', 'New Answer');

      const state = gameState.getGameState();
      expect(state.currentRound.submittedInCurrentPhase).toEqual(['Alice']);
      expect(state.currentRound.answers['Alice']).toBe('New Answer');
    });
  });

  describe('Array serialization', () => {
    beforeEach(() => {
      gameState.startRound('Test question');
      gameState.submitAnswer('socket1', 'Answer1');
      gameState.submitAnswer('socket2', 'Answer2');
    });

    test('submittedInCurrentPhase serializes correctly to JSON', () => {
      const state = gameState.getGameState();
      const json = JSON.stringify(state.currentRound);
      const parsed = JSON.parse(json);

      expect(parsed.submittedInCurrentPhase).toEqual(['Alice', 'Bob']);
      expect(Array.isArray(parsed.submittedInCurrentPhase)).toBe(true);
    });

    test('maintains order in array', () => {
      gameState.submitAnswer('socket3', 'Answer3');

      const state = gameState.getGameState();
      // Should maintain insertion order
      expect(state.currentRound.submittedInCurrentPhase[0]).toBe('Alice');
      expect(state.currentRound.submittedInCurrentPhase[1]).toBe('Bob');
      expect(state.currentRound.submittedInCurrentPhase[2]).toBe('Charlie');
    });

    test('can be sent over socket.io (JSON compatible)', () => {
      const state = gameState.getGameState();

      // Simulate what socket.io does - stringify and parse
      const socketData = JSON.parse(JSON.stringify({
        currentRound: state.currentRound
      }));

      expect(socketData.currentRound.submittedInCurrentPhase).toEqual(['Alice', 'Bob']);
    });
  });
});
