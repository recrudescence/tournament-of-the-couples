// Mock roomCodeGenerator before requiring gameState
jest.mock('../roomCodeGenerator', () => ({
  generateRoomCode: jest.fn(() => 'test'),
  generateTeamCode: jest.fn(() => 'team' + Math.random().toString(36).substr(2, 4)),
  validateRoomCode: jest.fn(() => true),
  markRoomInactive: jest.fn(),
  isRoomActive: jest.fn(() => true)
}));

const gameState = require('../gameState');

describe('GameState - Array Operations for submittedInCurrentPhase', () => {
  const roomCode = 'test';

  beforeEach(() => {
    // Initialize a fresh game for each test
    gameState.initializeGame(roomCode);

    // Add some test players
    gameState.addPlayer(roomCode, 'socket1', 'Alice', false);
    gameState.addPlayer(roomCode, 'socket2', 'Bob', false);
    gameState.addPlayer(roomCode, 'socket3', 'Charlie', false);
    gameState.addPlayer(roomCode, 'socket4', 'Diana', false);

    // Pair players into teams
    gameState.pairPlayers(roomCode, 'socket1', 'socket2');
    gameState.pairPlayers(roomCode, 'socket3', 'socket4');

    // Start the game
    gameState.startGame(roomCode);
  });

  describe('startRound', () => {
    test('initializes submittedInCurrentPhase as empty array', () => {
      gameState.startRound(roomCode, 'What is your favorite color?');

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.submittedInCurrentPhase).toEqual([]);
      expect(Array.isArray(state.currentRound.submittedInCurrentPhase)).toBe(true);
    });

    test('creates new array for each round', () => {
      gameState.startRound(roomCode, 'Round 1 question');
      const state1 = gameState.getGameState(roomCode);
      const array1 = state1.currentRound.submittedInCurrentPhase;

      gameState.completeRound(roomCode);
      gameState.returnToPlaying(roomCode);
      gameState.startRound(roomCode, 'Round 2 question');

      const state2 = gameState.getGameState(roomCode);
      const array2 = state2.currentRound.submittedInCurrentPhase;

      // Should be different array instances
      expect(array2).not.toBe(array1);
      expect(array2).toEqual([]);
    });
  });

  describe('submitAnswer', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Test question');
    });

    test('adds player name to array on first submission', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Red');

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.submittedInCurrentPhase).toEqual(['Alice']);
    });

    test('adds multiple players to array', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Red');
      gameState.submitAnswer(roomCode, 'socket2', 'Blue');
      gameState.submitAnswer(roomCode, 'socket3', 'Green');

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.submittedInCurrentPhase).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    test('does not add duplicate entries if same player submits twice', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Red');
      gameState.submitAnswer(roomCode, 'socket1', 'Blue'); // Resubmit with different answer

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.submittedInCurrentPhase).toEqual(['Alice']);
      expect(state.currentRound.submittedInCurrentPhase.length).toBe(1);
    });

    test('stores answer even when duplicate prevention triggers', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Red', 1000);
      gameState.submitAnswer(roomCode, 'socket1', 'Blue', 2000); // Update answer

      const state = gameState.getGameState(roomCode);
      // Array has one entry
      expect(state.currentRound.submittedInCurrentPhase).toEqual(['Alice']);
      // But answer is updated
      expect(state.currentRound.answers['Alice']).toEqual({ text: 'Blue', responseTime: 2000 });
    });
  });

  describe('isRoundComplete', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Test question');
    });

    test('returns false when no submissions', () => {
      expect(gameState.isRoundComplete(roomCode)).toBe(false);
    });

    test('returns false when some players have not submitted', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Answer1');
      gameState.submitAnswer(roomCode, 'socket2', 'Answer2');
      // Charlie and Diana have not submitted

      expect(gameState.isRoundComplete(roomCode)).toBe(false);
    });

    test('returns true when all connected players have submitted', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Answer1');
      gameState.submitAnswer(roomCode, 'socket2', 'Answer2');
      gameState.submitAnswer(roomCode, 'socket3', 'Answer3');
      gameState.submitAnswer(roomCode, 'socket4', 'Answer4');

      expect(gameState.isRoundComplete(roomCode)).toBe(true);
    });

    test('ignores disconnected players', () => {
      // Disconnect one player
      gameState.disconnectPlayer(roomCode, 'socket4');

      // Only need 3 submissions now
      gameState.submitAnswer(roomCode, 'socket1', 'Answer1');
      gameState.submitAnswer(roomCode, 'socket2', 'Answer2');
      gameState.submitAnswer(roomCode, 'socket3', 'Answer3');

      expect(gameState.isRoundComplete(roomCode)).toBe(true);
    });

    test('uses array.includes() for membership check', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Answer1');

      const state = gameState.getGameState(roomCode);
      // Verify we can use includes on the array
      expect(state.currentRound.submittedInCurrentPhase.includes('Alice')).toBe(true);
      expect(state.currentRound.submittedInCurrentPhase.includes('Bob')).toBe(false);
    });
  });

  describe('returnToAnswering', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Test question');
      // Submit all answers
      gameState.submitAnswer(roomCode, 'socket1', 'Answer1');
      gameState.submitAnswer(roomCode, 'socket2', 'Answer2');
      gameState.submitAnswer(roomCode, 'socket3', 'Answer3');
      gameState.submitAnswer(roomCode, 'socket4', 'Answer4');
      gameState.completeRound(roomCode);
    });

    test('clears submittedInCurrentPhase array', () => {
      const stateBefore = gameState.getGameState(roomCode);
      expect(stateBefore.currentRound.submittedInCurrentPhase.length).toBe(4);

      gameState.returnToAnswering(roomCode);

      const stateAfter = gameState.getGameState(roomCode);
      expect(stateAfter.currentRound.submittedInCurrentPhase).toEqual([]);
    });

    test('preserves answers for pre-filling', () => {
      gameState.returnToAnswering(roomCode);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answers).toEqual({
        'Alice': { text: 'Answer1', responseTime: -1 },
        'Bob': { text: 'Answer2', responseTime: -1 },
        'Charlie': { text: 'Answer3', responseTime: -1 },
        'Diana': { text: 'Answer4', responseTime: -1 }
      });
    });

    test('allows round to be incomplete again after clearing', () => {
      gameState.returnToAnswering(roomCode);

      // Round should not be complete with empty submission array
      expect(gameState.isRoundComplete(roomCode)).toBe(false);
    });

    test('can accept new submissions after reopening', () => {
      gameState.returnToAnswering(roomCode);

      // Alice resubmits
      gameState.submitAnswer(roomCode, 'socket1', 'New Answer', 1500);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.submittedInCurrentPhase).toEqual(['Alice']);
      expect(state.currentRound.answers['Alice']).toEqual({ text: 'New Answer', responseTime: 1500 });
    });
  });

  describe('Array serialization', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Test question');
      gameState.submitAnswer(roomCode, 'socket1', 'Answer1');
      gameState.submitAnswer(roomCode, 'socket2', 'Answer2');
    });

    test('submittedInCurrentPhase serializes correctly to JSON', () => {
      const state = gameState.getGameState(roomCode);
      const json = JSON.stringify(state.currentRound);
      const parsed = JSON.parse(json);

      expect(parsed.submittedInCurrentPhase).toEqual(['Alice', 'Bob']);
      expect(Array.isArray(parsed.submittedInCurrentPhase)).toBe(true);
    });

    test('maintains order in array', () => {
      gameState.submitAnswer(roomCode, 'socket3', 'Answer3');

      const state = gameState.getGameState(roomCode);
      // Should maintain insertion order
      expect(state.currentRound.submittedInCurrentPhase[0]).toBe('Alice');
      expect(state.currentRound.submittedInCurrentPhase[1]).toBe('Bob');
      expect(state.currentRound.submittedInCurrentPhase[2]).toBe('Charlie');
    });

    test('can be sent over socket.io (JSON compatible)', () => {
      const state = gameState.getGameState(roomCode);

      // Simulate what socket.io does - stringify and parse
      const socketData = JSON.parse(JSON.stringify({
        currentRound: state.currentRound
      }));

      expect(socketData.currentRound.submittedInCurrentPhase).toEqual(['Alice', 'Bob']);
    });
  });

  describe('Response Time Tracking', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Test question');
    });

    test('stores response time with answer', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Blue', 3420);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answers['Alice']).toEqual({
        text: 'Blue',
        responseTime: 3420
      });
    });

    test('defaults to -1 when no response time provided', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Red');

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answers['Alice']).toEqual({
        text: 'Red',
        responseTime: -1
      });
    });

    test('updates response time when player resubmits', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Blue', 3000);
      gameState.submitAnswer(roomCode, 'socket1', 'Red', 4000);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answers['Alice']).toEqual({
        text: 'Red',
        responseTime: 4000
      });
    });

    test('preserves response times when returning to answering', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Answer1', 2000);
      gameState.submitAnswer(roomCode, 'socket2', 'Answer2', 3000);
      gameState.submitAnswer(roomCode, 'socket3', 'Answer3', 1500);
      gameState.submitAnswer(roomCode, 'socket4', 'Answer4', 2500);
      gameState.completeRound(roomCode);

      gameState.returnToAnswering(roomCode);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answers['Alice'].responseTime).toBe(2000);
      expect(state.currentRound.answers['Bob'].responseTime).toBe(3000);
      expect(state.currentRound.answers['Charlie'].responseTime).toBe(1500);
      expect(state.currentRound.answers['Diana'].responseTime).toBe(2500);
    });

    test('answer objects serialize correctly to JSON', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Blue', 3420);

      const state = gameState.getGameState(roomCode);
      const json = JSON.stringify(state.currentRound.answers);
      const parsed = JSON.parse(json);

      expect(parsed['Alice']).toEqual({
        text: 'Blue',
        responseTime: 3420
      });
    });
  });
});
