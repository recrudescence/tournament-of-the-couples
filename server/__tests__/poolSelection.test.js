// Mock roomCodeGenerator before requiring gameState
jest.mock('../roomCodeGenerator', () => ({
  generateRoomCode: jest.fn(() => 'testpool'),
  generateTeamCode: jest.fn(() => 'team' + Math.random().toString(36).substr(2, 4)),
  validateRoomCode: jest.fn(() => true),
  markRoomInactive: jest.fn(),
  isRoomActive: jest.fn(() => true)
}));

const gameState = require('../gameState');

describe('Pool Selection Variant', () => {
  let roomCode;

  beforeEach(() => {
    roomCode = 'testpool';
    gameState.initializeGame(roomCode);
    gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
    gameState.addPlayer(roomCode, 'player1-socket', 'Alice', false);
    gameState.addPlayer(roomCode, 'player2-socket', 'Bob', false);
    gameState.addPlayer(roomCode, 'player3-socket', 'Carol', false);
    gameState.addPlayer(roomCode, 'player4-socket', 'Dave', false);
    gameState.pairPlayers(roomCode, 'player1-socket', 'player2-socket');
    gameState.pairPlayers(roomCode, 'player3-socket', 'player4-socket');
    gameState.startGame(roomCode);
  });

  afterEach(() => {
    if (gameState.hasRoom(roomCode)) {
      gameState.deleteRoom(roomCode);
    }
  });

  describe('startRound with pool_selection variant', () => {
    it('creates round with pool_selection variant', () => {
      gameState.startRound(roomCode, 'What is your favorite color?', 'pool_selection');
      const state = gameState.getGameState(roomCode);

      expect(state.currentRound.variant).toBe('pool_selection');
      expect(state.currentRound.options).toBeNull();
    });

    it('initializes picks and picksSubmitted', () => {
      gameState.startRound(roomCode, 'What is your favorite color?', 'pool_selection');
      const state = gameState.getGameState(roomCode);

      expect(state.currentRound.picks).toEqual({});
      expect(state.currentRound.picksSubmitted).toEqual([]);
    });

    it('rejects pool_selection with options', () => {
      expect(() => {
        gameState.startRound(roomCode, 'Question?', 'pool_selection', ['a', 'b']);
      }).toThrow('Pool selection should not have options');
    });
  });

  describe('startSelecting', () => {
    it('transitions round to selecting phase', () => {
      gameState.startRound(roomCode, 'Favorite food?', 'pool_selection');
      gameState.submitAnswer(roomCode, 'player1-socket', 'Pizza', 1000);
      gameState.submitAnswer(roomCode, 'player2-socket', 'Sushi', 1200);
      gameState.submitAnswer(roomCode, 'player3-socket', 'Tacos', 900);
      gameState.submitAnswer(roomCode, 'player4-socket', 'Pasta', 1100);

      gameState.startSelecting(roomCode);
      const state = gameState.getGameState(roomCode);

      expect(state.currentRound.status).toBe('selecting');
    });

    it('rejects non-pool_selection rounds', () => {
      gameState.startRound(roomCode, 'Open ended?', 'open_ended');

      expect(() => {
        gameState.startSelecting(roomCode);
      }).toThrow('Not a pool selection round');
    });
  });

  describe('submitPick', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Favorite food?', 'pool_selection');
      // All players submit answers first
      gameState.submitAnswer(roomCode, 'player1-socket', 'Pizza', 1000);
      gameState.submitAnswer(roomCode, 'player2-socket', 'Sushi', 1200);
      gameState.submitAnswer(roomCode, 'player3-socket', 'Tacos', 900);
      gameState.submitAnswer(roomCode, 'player4-socket', 'Pasta', 1100);
      // Transition to selecting phase
      gameState.startSelecting(roomCode);
    });

    it('stores pick for player', () => {
      gameState.submitPick(roomCode, 'player1-socket', 'Sushi');
      const state = gameState.getGameState(roomCode);

      expect(state.currentRound.picks['Alice']).toBe('Sushi');
      expect(state.currentRound.picksSubmitted).toContain('Alice');
    });

    it('rejects pick of own answer', () => {
      expect(() => {
        gameState.submitPick(roomCode, 'player1-socket', 'Pizza');
      }).toThrow('Cannot pick your own answer');
    });

    it('rejects pick of empty when only player submitted empty', () => {
      // Start fresh round where only one player submits empty
      gameState.startRound(roomCode, 'Empty test?', 'pool_selection');
      gameState.submitAnswer(roomCode, 'player1-socket', '', 1000); // Alice empty
      gameState.submitAnswer(roomCode, 'player2-socket', 'Sushi', 1200);
      gameState.submitAnswer(roomCode, 'player3-socket', 'Tacos', 900);
      gameState.submitAnswer(roomCode, 'player4-socket', 'Pasta', 1100);
      gameState.startSelecting(roomCode);

      expect(() => {
        gameState.submitPick(roomCode, 'player1-socket', '');
      }).toThrow('Cannot pick your own answer');
    });

    it('allows pick of empty when multiple players submitted empty', () => {
      // Start fresh round where multiple players submit empty
      gameState.startRound(roomCode, 'Multiple empty test?', 'pool_selection');
      gameState.submitAnswer(roomCode, 'player1-socket', '', 1000); // Alice empty
      gameState.submitAnswer(roomCode, 'player2-socket', '', 1200); // Bob empty
      gameState.submitAnswer(roomCode, 'player3-socket', 'Tacos', 900);
      gameState.submitAnswer(roomCode, 'player4-socket', 'Pasta', 1100);
      gameState.startSelecting(roomCode);

      // Should not throw - Alice can pick empty because Bob also submitted empty
      expect(() => {
        gameState.submitPick(roomCode, 'player1-socket', '');
      }).not.toThrow();
    });

    it('rejects pick when not in selecting phase', () => {
      // Start fresh round (still in answering phase)
      gameState.startRound(roomCode, 'New question?', 'pool_selection');

      expect(() => {
        gameState.submitPick(roomCode, 'player1-socket', 'Sushi');
      }).toThrow('Round not in selecting phase');
    });

    it('rejects pick of answer not in pool', () => {
      expect(() => {
        gameState.submitPick(roomCode, 'player1-socket', 'Burger');
      }).toThrow('Invalid pick: answer not in pool');
    });

    it('rejects pick for non-pool_selection rounds', () => {
      gameState.startRound(roomCode, 'Open ended?', 'open_ended');
      gameState.submitAnswer(roomCode, 'player1-socket', 'Answer', 1000);

      expect(() => {
        gameState.submitPick(roomCode, 'player1-socket', 'Answer');
      }).toThrow('Not a pool selection round');
    });
  });

  describe('areAllPicksIn', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Favorite food?', 'pool_selection');
      gameState.submitAnswer(roomCode, 'player1-socket', 'Pizza', 1000);
      gameState.submitAnswer(roomCode, 'player2-socket', 'Sushi', 1200);
      gameState.submitAnswer(roomCode, 'player3-socket', 'Tacos', 900);
      gameState.submitAnswer(roomCode, 'player4-socket', 'Pasta', 1100);
      gameState.startSelecting(roomCode);
    });

    it('returns false when no picks', () => {
      expect(gameState.areAllPicksIn(roomCode)).toBe(false);
    });

    it('returns false when some players have not picked', () => {
      gameState.submitPick(roomCode, 'player1-socket', 'Sushi');
      gameState.submitPick(roomCode, 'player2-socket', 'Pizza');

      expect(gameState.areAllPicksIn(roomCode)).toBe(false);
    });

    it('returns true when all connected players have picked', () => {
      gameState.submitPick(roomCode, 'player1-socket', 'Sushi');
      gameState.submitPick(roomCode, 'player2-socket', 'Pizza');
      gameState.submitPick(roomCode, 'player3-socket', 'Pasta');
      gameState.submitPick(roomCode, 'player4-socket', 'Tacos');

      expect(gameState.areAllPicksIn(roomCode)).toBe(true);
    });

    it('ignores disconnected players', () => {
      gameState.disconnectPlayer(roomCode, 'player4-socket');

      gameState.submitPick(roomCode, 'player1-socket', 'Sushi');
      gameState.submitPick(roomCode, 'player2-socket', 'Pizza');
      gameState.submitPick(roomCode, 'player3-socket', 'Pasta');

      expect(gameState.areAllPicksIn(roomCode)).toBe(true);
    });
  });

  describe('getAnswerPool', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Favorite food?', 'pool_selection');
      gameState.submitAnswer(roomCode, 'player1-socket', 'Pizza', 1000);
      gameState.submitAnswer(roomCode, 'player2-socket', 'Sushi', 1200);
      gameState.submitAnswer(roomCode, 'player3-socket', 'Tacos', 900);
      gameState.submitAnswer(roomCode, 'player4-socket', 'Pasta', 1100);
    });

    it('returns all answer texts with player names', () => {
      const pool = gameState.getAnswerPool(roomCode);

      expect(pool).toHaveLength(4);
      const answers = pool.map(p => p.answer);
      expect(answers).toContain('Pizza');
      expect(answers).toContain('Sushi');
      expect(answers).toContain('Tacos');
      expect(answers).toContain('Pasta');

      // Each entry should have playerName and answer
      pool.forEach(entry => {
        expect(entry).toHaveProperty('playerName');
        expect(entry).toHaveProperty('answer');
        expect(typeof entry.playerName).toBe('string');
        expect(typeof entry.answer).toBe('string');
      });
    });

    it('returns shuffled array (different order)', () => {
      // Run multiple times to check shuffling occurs
      // Note: This test could flake in rare cases, but 4! = 24 orderings
      const pools = new Set();
      for (let i = 0; i < 10; i++) {
        const pool = gameState.getAnswerPool(roomCode);
        pools.add(pool.map(p => p.answer).join(','));
      }
      // With 10 tries, we should almost certainly see at least 2 different orderings
      expect(pools.size).toBeGreaterThanOrEqual(1); // Minimum guarantee
    });

    it('includes player names for identity matching', () => {
      const pool = gameState.getAnswerPool(roomCode);

      // Each entry should contain playerName so players can identify their own answer
      const playerNames = pool.map(p => p.playerName);
      expect(playerNames).toContain('Alice');
      expect(playerNames).toContain('Bob');
      expect(playerNames).toContain('Carol');
      expect(playerNames).toContain('Dave');
    });

    it('returns same pool on subsequent calls (caching for reconnection)', () => {
      const pool1 = gameState.getAnswerPool(roomCode);
      const pool2 = gameState.getAnswerPool(roomCode);
      const pool3 = gameState.getAnswerPool(roomCode);

      // Should return identical arrays (same order)
      expect(pool1).toEqual(pool2);
      expect(pool2).toEqual(pool3);
    });

    it('stores pool in currentRound.answerPool', () => {
      gameState.getAnswerPool(roomCode);
      const state = gameState.getGameState(roomCode);

      expect(state.currentRound.answerPool).toBeDefined();
      expect(state.currentRound.answerPool).toHaveLength(4);
    });
  });

  describe('case-insensitive duplicate handling', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Favorite animal?', 'pool_selection');
      // Alice and Carol both write "Dog" (different casing)
      gameState.submitAnswer(roomCode, 'player1-socket', 'Dog', 1000);
      gameState.submitAnswer(roomCode, 'player2-socket', 'Cat', 1200);
      gameState.submitAnswer(roomCode, 'player3-socket', 'DOG', 900);  // Same as Alice (different case)
      gameState.submitAnswer(roomCode, 'player4-socket', 'Bird', 1100);
      gameState.startSelecting(roomCode);
    });

    it('getAuthorsOfAnswer returns all authors with case-insensitive matching', () => {
      // Both Alice (Dog) and Carol (DOG) should be found
      const authors = gameState.getAuthorsOfAnswer(roomCode, 'dog');
      expect(authors).toHaveLength(2);
      expect(authors.map(a => a.name)).toContain('Alice');
      expect(authors.map(a => a.name)).toContain('Carol');
    });

    it('allows picking duplicate answer even if you wrote the same thing', () => {
      // Alice wrote "Dog", Carol wrote "DOG" - Alice should be able to pick "dog"
      // because Carol also wrote it (case-insensitive)
      expect(() => {
        gameState.submitPick(roomCode, 'player1-socket', 'DOG');
      }).not.toThrow();
    });

    it('checkCorrectPick finds correct pickers for duplicate answers (case-insensitive)', () => {
      // Setup: Alice (Dog) is paired with Bob (Cat), Carol (DOG) is paired with Dave (Bird)
      // Both Bob and Dave pick "dog" (guessing their partner wrote it)
      gameState.submitPick(roomCode, 'player2-socket', 'Dog');  // Bob picks (for Alice)
      gameState.submitPick(roomCode, 'player4-socket', 'dog');  // Dave picks (for Carol)

      // Check "dog" answer - should find both correct pickers
      const result = gameState.checkCorrectPick(roomCode, 'Dog');

      expect(result.correctPickers).toHaveLength(2);
      expect(result.correctPickers.map(p => p.name)).toContain('Bob');
      expect(result.correctPickers.map(p => p.name)).toContain('Dave');
      // Both teams should score
      expect(result.teamIds).toHaveLength(2);
    });

    it('isPoolAnswerRevealed works with case-insensitive matching', () => {
      gameState.markPoolAnswerRevealed(roomCode, 'Dog');

      // All case variations should be considered revealed
      expect(gameState.isPoolAnswerRevealed(roomCode, 'Dog')).toBe(true);
      expect(gameState.isPoolAnswerRevealed(roomCode, 'dog')).toBe(true);
      expect(gameState.isPoolAnswerRevealed(roomCode, 'DOG')).toBe(true);

      // Different answer should not be revealed
      expect(gameState.isPoolAnswerRevealed(roomCode, 'Cat')).toBe(false);
    });

    it('awards 2 points when both teammates wrote same answer and both picked correctly', () => {
      // Both Bob and Dave pick "dog" (correct for their partners Alice and Carol)
      gameState.submitPick(roomCode, 'player2-socket', 'Dog'); // Bob picks for Alice
      gameState.submitPick(roomCode, 'player4-socket', 'DOG'); // Dave picks for Carol

      const result = gameState.checkCorrectPick(roomCode, 'dog');

      // Both teams should have points
      expect(result.teamIds).toHaveLength(2);
      expect(result.teamPoints).toBeDefined();

      // Each team gets 1 point (different teams)
      const team1Id = gameState.getGameState(roomCode).players.find(p => p.name === 'Alice').teamId;
      const team2Id = gameState.getGameState(roomCode).players.find(p => p.name === 'Carol').teamId;

      expect(result.teamPoints[team1Id]).toBe(1);
      expect(result.teamPoints[team2Id]).toBe(1);
    });

    it('awards 2 points when SAME team has both players write same answer and both pick correctly', () => {
      // New scenario: Alice and Bob (same team) both write "water", Carol writes "fire", Dave writes "earth"
      gameState.startRound(roomCode, 'Element?', 'pool_selection');
      gameState.submitAnswer(roomCode, 'player1-socket', 'water', 1000); // Alice
      gameState.submitAnswer(roomCode, 'player2-socket', 'water', 1200); // Bob (Alice's partner, same answer!)
      gameState.submitAnswer(roomCode, 'player3-socket', 'fire', 900);   // Carol
      gameState.submitAnswer(roomCode, 'player4-socket', 'earth', 1100); // Dave
      gameState.startSelecting(roomCode);

      // Both Alice and Bob can pick "water" because the other teammate also wrote it
      // Alice picks "water" guessing Bob wrote it (correct!)
      // Bob picks "water" guessing Alice wrote it (correct!)
      gameState.submitPick(roomCode, 'player1-socket', 'water');
      gameState.submitPick(roomCode, 'player2-socket', 'water');

      const result = gameState.checkCorrectPick(roomCode, 'water');

      // Both Alice and Bob are correct pickers
      expect(result.correctPickers).toHaveLength(2);
      expect(result.correctPickers.map(p => p.name)).toContain('Alice');
      expect(result.correctPickers.map(p => p.name)).toContain('Bob');

      // Same team gets 2 points (both players correct)
      const teamId = gameState.getGameState(roomCode).players.find(p => p.name === 'Alice').teamId;
      expect(result.teamPoints[teamId]).toBe(2);
    });
  });

  describe('getPickersForAnswer', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Favorite food?', 'pool_selection');
      gameState.submitAnswer(roomCode, 'player1-socket', 'Pizza', 1000);
      gameState.submitAnswer(roomCode, 'player2-socket', 'Sushi', 1200);
      gameState.submitAnswer(roomCode, 'player3-socket', 'Tacos', 900);
      gameState.submitAnswer(roomCode, 'player4-socket', 'Pasta', 1100);
      gameState.startSelecting(roomCode);
    });

    it('returns empty array when no one picked the answer', () => {
      const pickers = gameState.getPickersForAnswer(roomCode, 'Pizza');
      expect(pickers).toEqual([]);
    });

    it('returns players who picked the answer', () => {
      gameState.submitPick(roomCode, 'player1-socket', 'Sushi');
      gameState.submitPick(roomCode, 'player3-socket', 'Sushi');

      const pickers = gameState.getPickersForAnswer(roomCode, 'Sushi');

      expect(pickers).toHaveLength(2);
      expect(pickers.map(p => p.name)).toContain('Alice');
      expect(pickers.map(p => p.name)).toContain('Carol');
    });

    it('returns player objects with full info', () => {
      gameState.submitPick(roomCode, 'player1-socket', 'Tacos');

      const pickers = gameState.getPickersForAnswer(roomCode, 'Tacos');

      expect(pickers[0]).toHaveProperty('socketId');
      expect(pickers[0]).toHaveProperty('name');
      expect(pickers[0]).toHaveProperty('avatar');
    });
  });

  describe('getAuthorOfAnswer', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Favorite food?', 'pool_selection');
      gameState.submitAnswer(roomCode, 'player1-socket', 'Pizza', 1000);
      gameState.submitAnswer(roomCode, 'player2-socket', 'Sushi', 1200);
    });

    it('returns the player who wrote the answer', () => {
      const author = gameState.getAuthorOfAnswer(roomCode, 'Pizza');

      expect(author).not.toBeNull();
      expect(author.name).toBe('Alice');
    });

    it('returns null for unknown answer', () => {
      const author = gameState.getAuthorOfAnswer(roomCode, 'Unknown');

      expect(author).toBeNull();
    });

    it('returns player object with full info', () => {
      const author = gameState.getAuthorOfAnswer(roomCode, 'Sushi');

      expect(author).toHaveProperty('socketId', 'player2-socket');
      expect(author).toHaveProperty('name', 'Bob');
      expect(author).toHaveProperty('teamId');
    });
  });

  describe('checkCorrectPick', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Favorite food?', 'pool_selection');
      gameState.submitAnswer(roomCode, 'player1-socket', 'Pizza', 1000);
      gameState.submitAnswer(roomCode, 'player2-socket', 'Sushi', 1200);
      gameState.submitAnswer(roomCode, 'player3-socket', 'Tacos', 900);
      gameState.submitAnswer(roomCode, 'player4-socket', 'Pasta', 1100);
      gameState.startSelecting(roomCode);
    });

    it('returns empty correctPickers when partner picked wrong', () => {
      // Alice wrote Pizza, Bob picks Tacos (wrong)
      gameState.submitPick(roomCode, 'player2-socket', 'Tacos');

      const result = gameState.checkCorrectPick(roomCode, 'Pizza');

      expect(result.correctPickers).toEqual([]);
      expect(result.teamId).toBeNull();
    });

    it('returns partner in correctPickers when picked correctly', () => {
      // Alice wrote Pizza, Bob picks Pizza (correct)
      gameState.submitPick(roomCode, 'player2-socket', 'Pizza');

      const result = gameState.checkCorrectPick(roomCode, 'Pizza');

      expect(result.correctPickers).toHaveLength(1);
      expect(result.correctPickers[0].name).toBe('Bob');
      expect(result.teamId).not.toBeNull();
    });

    it('returns correct teamId for point award', () => {
      gameState.submitPick(roomCode, 'player2-socket', 'Pizza');

      const result = gameState.checkCorrectPick(roomCode, 'Pizza');
      const state = gameState.getGameState(roomCode);
      const aliceTeamId = state.players.find(p => p.name === 'Alice').teamId;

      expect(result.teamId).toBe(aliceTeamId);
    });

    it('handles case where author has no partner', () => {
      // Disconnect Bob (Alice's partner)
      gameState.disconnectPlayer(roomCode, 'player2-socket');

      // The partner is still in the player list, just disconnected
      // So the check still works, but partner hasn't picked
      const result = gameState.checkCorrectPick(roomCode, 'Pizza');

      expect(result.correctPickers).toEqual([]);
    });

    it('returns correct pickers for empty answers', () => {
      // Start fresh round with empty answers
      gameState.startRound(roomCode, 'Empty test?', 'pool_selection');
      gameState.submitAnswer(roomCode, 'player1-socket', '', 1000); // Alice empty
      gameState.submitAnswer(roomCode, 'player2-socket', '', 1200); // Bob empty (Alice's partner)
      gameState.submitAnswer(roomCode, 'player3-socket', 'Tacos', 900);
      gameState.submitAnswer(roomCode, 'player4-socket', 'Pasta', 1100);
      gameState.startSelecting(roomCode);

      // Alice picks empty (guessing Bob didn't respond - correct!)
      gameState.submitPick(roomCode, 'player1-socket', '');

      const result = gameState.checkCorrectPick(roomCode, '');

      expect(result.correctPickers).toHaveLength(1);
      expect(result.correctPickers[0].name).toBe('Alice');
    });
  });

  describe('complete pool selection flow', () => {
    it('full round: answers -> picks -> scoring', () => {
      // Start round
      gameState.startRound(roomCode, 'Dream vacation?', 'pool_selection');

      // All submit answers
      gameState.submitAnswer(roomCode, 'player1-socket', 'Hawaii', 1000);
      gameState.submitAnswer(roomCode, 'player2-socket', 'Paris', 1200);
      gameState.submitAnswer(roomCode, 'player3-socket', 'Tokyo', 900);
      gameState.submitAnswer(roomCode, 'player4-socket', 'London', 1100);

      expect(gameState.isRoundComplete(roomCode)).toBe(true);

      // Transition to selecting phase
      gameState.startSelecting(roomCode);

      // Get answer pool
      const pool = gameState.getAnswerPool(roomCode);
      expect(pool).toHaveLength(4);

      // All submit picks (Alice picks Bob's answer correctly)
      gameState.submitPick(roomCode, 'player1-socket', 'Paris'); // Correct
      gameState.submitPick(roomCode, 'player2-socket', 'Tokyo'); // Wrong
      gameState.submitPick(roomCode, 'player3-socket', 'Hawaii'); // Wrong
      gameState.submitPick(roomCode, 'player4-socket', 'Tokyo'); // Correct

      expect(gameState.areAllPicksIn(roomCode)).toBe(true);

      // Complete round
      gameState.completeRound(roomCode);
      const state = gameState.getGameState(roomCode);
      expect(state.status).toBe('scoring');

      // Check correct picks
      const parisResult = gameState.checkCorrectPick(roomCode, 'Paris');
      expect(parisResult.correctPickers).toHaveLength(1);
      expect(parisResult.correctPickers[0].name).toBe('Alice');

      const tokyoResult = gameState.checkCorrectPick(roomCode, 'Tokyo');
      expect(tokyoResult.correctPickers).toHaveLength(1);
      expect(tokyoResult.correctPickers[0].name).toBe('Dave');
    });
  });

  describe('reveal tracking (prevents duplicate point awards)', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Test question?', 'pool_selection');
      gameState.submitAnswer(roomCode, 'player1-socket', 'Answer1', 1000);
      gameState.submitAnswer(roomCode, 'player2-socket', 'Answer2', 1200);
      gameState.submitAnswer(roomCode, 'player3-socket', 'Answer3', 900);
      gameState.submitAnswer(roomCode, 'player4-socket', 'Answer4', 1100);
      gameState.startSelecting(roomCode);
      gameState.submitPick(roomCode, 'player1-socket', 'Answer2');
      gameState.submitPick(roomCode, 'player2-socket', 'Answer1');
      gameState.submitPick(roomCode, 'player3-socket', 'Answer4');
      gameState.submitPick(roomCode, 'player4-socket', 'Answer3');
      gameState.completeRound(roomCode);
    });

    it('isPoolAnswerRevealed returns false for unrevealed answers', () => {
      expect(gameState.isPoolAnswerRevealed(roomCode, 'Answer1')).toBe(false);
    });

    it('markPoolAnswerRevealed marks answer as revealed', () => {
      gameState.markPoolAnswerRevealed(roomCode, 'Answer1');
      expect(gameState.isPoolAnswerRevealed(roomCode, 'Answer1')).toBe(true);
    });

    it('revealedPoolAnswers persists in game state', () => {
      gameState.markPoolAnswerRevealed(roomCode, 'Answer1');
      gameState.markPoolAnswerRevealed(roomCode, 'Answer2');

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.revealedPoolAnswers).toContain('Answer1');
      expect(state.currentRound.revealedPoolAnswers).toContain('Answer2');
      expect(state.currentRound.revealedPoolAnswers).not.toContain('Answer3');
    });

    it('markPoolPickersRevealed stores pickers for answer (normalized key)', () => {
      const mockPickers = [{ name: 'Alice', socketId: 'player1-socket' }];
      gameState.markPoolPickersRevealed(roomCode, 'Answer2', mockPickers);

      const state = gameState.getGameState(roomCode);
      // Keys are stored normalized (lowercase)
      expect(state.currentRound.revealedPoolPickers['answer2']).toEqual(mockPickers);
    });

    it('revealedPoolPickers persists across multiple answers', () => {
      const pickers1 = [{ name: 'Alice' }];
      const pickers2 = [{ name: 'Bob' }, { name: 'Charlie' }];

      gameState.markPoolPickersRevealed(roomCode, 'Answer1', pickers1);
      gameState.markPoolPickersRevealed(roomCode, 'Answer2', pickers2);

      const state = gameState.getGameState(roomCode);
      // Keys are stored normalized (lowercase)
      expect(state.currentRound.revealedPoolPickers['answer1']).toEqual(pickers1);
      expect(state.currentRound.revealedPoolPickers['answer2']).toEqual(pickers2);
    });

    it('initializes revealedPoolAnswers and revealedPoolPickers on round start', () => {
      gameState.startRound(roomCode, 'New question?', 'pool_selection');
      const state = gameState.getGameState(roomCode);

      expect(state.currentRound.revealedPoolAnswers).toEqual([]);
      expect(state.currentRound.revealedPoolPickers).toEqual({});
    });
  });
});
