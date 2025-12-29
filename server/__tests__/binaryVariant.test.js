// Mock random-words before importing gameState
jest.mock('random-words', () => ({
  generate: jest.fn(() => ['testwd'])
}));

const gameState = require('../gameState');

describe('Binary Variant Integration Tests', () => {
  let roomCode;

  beforeEach(() => {
    roomCode = 'test-binary';
    gameState.initializeGame(roomCode);
    gameState.addPlayer(roomCode, 'socket1', 'Alice', false);
    gameState.addPlayer(roomCode, 'socket2', 'Bob', false);
    gameState.addPlayer(roomCode, 'socket3', 'Charlie', false);
    gameState.addPlayer(roomCode, 'socket4', 'Diana', false);
    gameState.pairPlayers(roomCode, 'socket1', 'socket2');
    gameState.pairPlayers(roomCode, 'socket3', 'socket4');
    gameState.startGame(roomCode);
  });

  afterEach(() => {
    gameState.deleteRoom(roomCode);
  });

  describe('Starting binary rounds', () => {
    test('creates binary round with placeholder options', () => {
      gameState.startRound(
        roomCode,
        'Who is more likely to cook dinner?',
        'binary',
        ['Player 1', 'Player 2']
      );

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.variant).toBe('binary');
      expect(state.currentRound.options).toEqual(['Player 1', 'Player 2']);
    });

    test('requires exactly 2 options for binary variant', () => {
      expect(() => {
        gameState.startRound(roomCode, 'Question?', 'binary', ['Only one']);
      }).toThrow('Binary requires exactly 2 options');

      expect(() => {
        gameState.startRound(roomCode, 'Question?', 'binary', ['One', 'Two', 'Three']);
      }).toThrow('Binary requires exactly 2 options');
    });

    test('requires options for binary variant', () => {
      expect(() => {
        gameState.startRound(roomCode, 'Question?', 'binary', null);
      }).toThrow('Binary requires exactly 2 options');
    });
  });

  describe('Submitting binary answers', () => {
    beforeEach(() => {
      gameState.startRound(
        roomCode,
        'Who is more likely to cook dinner?',
        'binary',
        ['Player 1', 'Player 2']
      );
    });

    test('accepts valid binary answers', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 1000);
      gameState.submitAnswer(roomCode, 'socket2', 'Bob', 1200);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answers['Alice'].text).toBe('Alice');
      expect(state.currentRound.answers['Bob'].text).toBe('Bob');
    });

    test('accepts partner names as valid answers', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Bob', 1000);
      gameState.submitAnswer(roomCode, 'socket2', 'Alice', 1200);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answers['Alice'].text).toBe('Bob');
      expect(state.currentRound.answers['Bob'].text).toBe('Alice');
    });

    test('tracks submittedInCurrentPhase for binary answers', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 1000);

      let state = gameState.getGameState(roomCode);
      expect(state.currentRound.submittedInCurrentPhase).toContain('Alice');
      expect(state.currentRound.submittedInCurrentPhase.length).toBe(1);

      gameState.submitAnswer(roomCode, 'socket2', 'Bob', 1200);

      state = gameState.getGameState(roomCode);
      expect(state.currentRound.submittedInCurrentPhase).toContain('Alice');
      expect(state.currentRound.submittedInCurrentPhase).toContain('Bob');
      expect(state.currentRound.submittedInCurrentPhase.length).toBe(2);
    });

    test('stores response times for binary answers', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 3456);
      gameState.submitAnswer(roomCode, 'socket2', 'Bob', 2789);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answers['Alice'].responseTime).toBe(3456);
      expect(state.currentRound.answers['Bob'].responseTime).toBe(2789);
    });
  });

  describe('Complete round with binary variant', () => {
    beforeEach(() => {
      gameState.startRound(
        roomCode,
        'Who is more likely to cook dinner?',
        'binary',
        ['Player 1', 'Player 2']
      );
    });

    test('isRoundComplete returns true when all answers submitted', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 1000);
      gameState.submitAnswer(roomCode, 'socket2', 'Bob', 1200);
      gameState.submitAnswer(roomCode, 'socket3', 'Charlie', 1500);
      gameState.submitAnswer(roomCode, 'socket4', 'Diana', 1300);

      const isComplete = gameState.isRoundComplete(roomCode);
      expect(isComplete).toBe(true);
    });

    test('completeRound works with binary answers', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 1000);
      gameState.submitAnswer(roomCode, 'socket2', 'Bob', 1200);
      gameState.submitAnswer(roomCode, 'socket3', 'Charlie', 1500);
      gameState.submitAnswer(roomCode, 'socket4', 'Diana', 1300);

      gameState.completeRound(roomCode);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.status).toBe('complete');
      expect(state.status).toBe('scoring');
    });
  });

  describe('Binary variant with returnToAnswering', () => {
    beforeEach(() => {
      gameState.startRound(
        roomCode,
        'Who is more likely to cook dinner?',
        'binary',
        ['Player 1', 'Player 2']
      );
      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 1000);
      gameState.submitAnswer(roomCode, 'socket2', 'Bob', 1200);
      gameState.submitAnswer(roomCode, 'socket3', 'Charlie', 1500);
      gameState.submitAnswer(roomCode, 'socket4', 'Diana', 1300);
      gameState.completeRound(roomCode);
    });

    test('preserves binary variant and options when reopening', () => {
      gameState.returnToAnswering(roomCode);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.variant).toBe('binary');
      expect(state.currentRound.options).toEqual(['Player 1', 'Player 2']);
    });

    test('clears submittedInCurrentPhase but preserves answers', () => {
      gameState.returnToAnswering(roomCode);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.submittedInCurrentPhase).toEqual([]);
      expect(state.currentRound.answers['Alice']).toBeDefined();
      expect(state.currentRound.answers['Bob']).toBeDefined();
      expect(state.currentRound.answers['Charlie']).toBeDefined();
      expect(state.currentRound.answers['Diana']).toBeDefined();
    });

    test('allows resubmission after reopening binary round', () => {
      gameState.returnToAnswering(roomCode);

      // Resubmit with different answer
      gameState.submitAnswer(roomCode, 'socket1', 'Bob', 2000);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answers['Alice'].text).toBe('Bob');
      expect(state.currentRound.answers['Alice'].responseTime).toBe(2000);
      expect(state.currentRound.submittedInCurrentPhase).toContain('Alice');
      expect(state.currentRound.submittedInCurrentPhase.length).toBe(1);
    });

    test('can complete reopened binary round', () => {
      gameState.returnToAnswering(roomCode);

      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 2000);
      gameState.submitAnswer(roomCode, 'socket2', 'Bob', 2100);
      gameState.submitAnswer(roomCode, 'socket3', 'Charlie', 2200);
      gameState.submitAnswer(roomCode, 'socket4', 'Diana', 2300);

      const isComplete = gameState.isRoundComplete(roomCode);
      const state = gameState.getGameState(roomCode);

      expect(isComplete).toBe(true);
      expect(state.currentRound.submittedInCurrentPhase.length).toBe(4);
    });
  });

  describe('Multiple binary rounds', () => {
    test('can run multiple binary rounds in sequence', () => {
      // Round 1
      gameState.startRound(
        roomCode,
        'Who is more likely to cook?',
        'binary',
        ['Player 1', 'Player 2']
      );
      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 1000);
      gameState.submitAnswer(roomCode, 'socket2', 'Bob', 1200);
      gameState.submitAnswer(roomCode, 'socket3', 'Charlie', 1500);
      gameState.submitAnswer(roomCode, 'socket4', 'Diana', 1300);
      gameState.completeRound(roomCode);

      // Round 2
      gameState.startRound(
        roomCode,
        'Who is more likely to do dishes?',
        'binary',
        ['Player 1', 'Player 2']
      );

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.roundNumber).toBe(2);
      expect(state.currentRound.variant).toBe('binary');
      expect(state.currentRound.options).toEqual(['Player 1', 'Player 2']);
      expect(state.currentRound.answers).toEqual({});
      expect(state.currentRound.submittedInCurrentPhase).toEqual([]);
    });

    test('each binary round maintains independent state', () => {
      // Round 1
      gameState.startRound(roomCode, 'Question 1', 'binary', ['Player 1', 'Player 2']);
      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 1000);
      gameState.completeRound(roomCode);
      const round1Answers = gameState.getGameState(roomCode).currentRound.answers;

      // Round 2
      gameState.startRound(roomCode, 'Question 2', 'binary', ['Player 1', 'Player 2']);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answers).not.toEqual(round1Answers);
      expect(state.currentRound.answers).toEqual({});
    });
  });

  describe('Mixed variant rounds', () => {
    test('can alternate between binary and open_ended rounds', () => {
      // Binary round
      gameState.startRound(roomCode, 'Question 1', 'binary', ['Player 1', 'Player 2']);
      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 1000);
      gameState.submitAnswer(roomCode, 'socket2', 'Bob', 1200);
      gameState.submitAnswer(roomCode, 'socket3', 'Charlie', 1500);
      gameState.submitAnswer(roomCode, 'socket4', 'Diana', 1300);
      gameState.completeRound(roomCode);

      // Open-ended round
      gameState.startRound(roomCode, 'Question 2', 'open_ended', null);

      let state = gameState.getGameState(roomCode);
      expect(state.currentRound.variant).toBe('open_ended');
      expect(state.currentRound.options).toBeNull();

      gameState.submitAnswer(roomCode, 'socket1', 'Text answer', 2000);
      gameState.submitAnswer(roomCode, 'socket2', 'Another answer', 2100);
      gameState.submitAnswer(roomCode, 'socket3', 'Third answer', 2200);
      gameState.submitAnswer(roomCode, 'socket4', 'Fourth answer', 2300);
      gameState.completeRound(roomCode);

      // Back to binary
      gameState.startRound(roomCode, 'Question 3', 'binary', ['Player 1', 'Player 2']);

      state = gameState.getGameState(roomCode);
      expect(state.currentRound.roundNumber).toBe(3);
      expect(state.currentRound.variant).toBe('binary');
      expect(state.currentRound.options).toEqual(['Player 1', 'Player 2']);
    });

    test('can alternate between binary and multiple_choice rounds', () => {
      // Binary round
      gameState.startRound(roomCode, 'Question 1', 'binary', ['Player 1', 'Player 2']);
      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 1000);
      gameState.submitAnswer(roomCode, 'socket2', 'Bob', 1200);
      gameState.submitAnswer(roomCode, 'socket3', 'Charlie', 1500);
      gameState.submitAnswer(roomCode, 'socket4', 'Diana', 1300);
      gameState.completeRound(roomCode);

      // Multiple choice round
      gameState.startRound(roomCode, 'Favorite color?', 'multiple_choice', ['Red', 'Blue', 'Green']);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.variant).toBe('multiple_choice');
      expect(state.currentRound.options).toEqual(['Red', 'Blue', 'Green']);
    });
  });

  describe('Edge cases', () => {
    test('handles empty string answers in binary questions', () => {
      gameState.startRound(roomCode, 'Question?', 'binary', ['Player 1', 'Player 2']);

      expect(() => {
        gameState.submitAnswer(roomCode, 'socket1', '', 1000);
      }).toThrow('Answer cannot be empty');
    });

    test('allows updating answer during same phase', () => {
      gameState.startRound(roomCode, 'Question?', 'binary', ['Player 1', 'Player 2']);
      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 1000);
      gameState.submitAnswer(roomCode, 'socket1', 'Bob', 2000);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answers['Alice'].text).toBe('Bob');
      expect(state.currentRound.answers['Alice'].responseTime).toBe(2000);
      expect(state.currentRound.submittedInCurrentPhase).toEqual(['Alice']);
      expect(state.currentRound.submittedInCurrentPhase.length).toBe(1);
    });

    test('allows changing answer after reopening binary round', () => {
      gameState.startRound(roomCode, 'Question?', 'binary', ['Player 1', 'Player 2']);
      gameState.submitAnswer(roomCode, 'socket1', 'Alice', 1000);
      gameState.submitAnswer(roomCode, 'socket2', 'Bob', 1200);
      gameState.submitAnswer(roomCode, 'socket3', 'Charlie', 1500);
      gameState.submitAnswer(roomCode, 'socket4', 'Diana', 1300);
      gameState.completeRound(roomCode);

      gameState.returnToAnswering(roomCode);

      // Should allow resubmission with different answer
      gameState.submitAnswer(roomCode, 'socket1', 'Bob', 3000);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answers['Alice'].text).toBe('Bob');
      expect(state.currentRound.answers['Alice'].responseTime).toBe(3000);
    });
  });
});
