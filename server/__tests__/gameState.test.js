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

    test('sets answerForBoth to false by default', () => {
      gameState.startRound(roomCode, 'What is your favorite color?');

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answerForBoth).toBe(false);
    });

    test('sets answerForBoth to true when specified', () => {
      gameState.startRound(roomCode, 'What would your partner say?', 'open_ended', null, true);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answerForBoth).toBe(true);
    });

    test('answerForBoth works with multiple_choice variant', () => {
      gameState.startRound(roomCode, 'Who is messier?', 'multiple_choice', ['Option A', 'Option B'], true);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answerForBoth).toBe(true);
      expect(state.currentRound.variant).toBe('multiple_choice');
      expect(state.currentRound.options).toEqual(['Option A', 'Option B']);
    });

    test('answerForBoth works with binary variant', () => {
      gameState.startRound(roomCode, 'Who cooks more?', 'binary', ['Player 1', 'Player 2'], true);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answerForBoth).toBe(true);
      expect(state.currentRound.variant).toBe('binary');
    });

    test('answerForBoth persists through round lifecycle', () => {
      gameState.startRound(roomCode, 'Dual answer question', 'open_ended', null, true);

      // Submit answers
      gameState.submitAnswer(roomCode, 'socket1', JSON.stringify({ 'Alice': 'A1', 'Bob': 'A2' }), 1000);
      gameState.submitAnswer(roomCode, 'socket2', JSON.stringify({ 'Alice': 'B1', 'Bob': 'B2' }), 1500);

      // Complete round
      gameState.completeRound(roomCode);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.answerForBoth).toBe(true);
      expect(state.currentRound.status).toBe('complete');
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

describe('GameState - Player and Host Management', () => {
  const roomCode = 'test';

  beforeEach(() => {
    gameState.initializeGame(roomCode);
    gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
    gameState.addPlayer(roomCode, 'socket1', 'Alice', false);
    gameState.addPlayer(roomCode, 'socket2', 'Bob', false);
  });

  describe('removePlayer', () => {
    test('removes player from lobby', () => {
      gameState.removePlayer(roomCode, 'socket1');

      const state = gameState.getGameState(roomCode);
      expect(state.players).toHaveLength(1);
      expect(state.players.find(p => p.name === 'Alice')).toBeUndefined();
    });

    test('unpairs player before removing if they were paired', () => {
      gameState.pairPlayers(roomCode, 'socket1', 'socket2');
      expect(gameState.getGameState(roomCode).teams).toHaveLength(1);

      gameState.removePlayer(roomCode, 'socket1');

      const state = gameState.getGameState(roomCode);
      expect(state.teams).toHaveLength(0);
      expect(state.players.find(p => p.name === 'Bob').partnerId).toBeNull();
    });

    test('does nothing if player not found', () => {
      gameState.removePlayer(roomCode, 'nonexistent-socket');

      const state = gameState.getGameState(roomCode);
      expect(state.players).toHaveLength(2);
    });

    test('does nothing if room not found', () => {
      expect(() => {
        gameState.removePlayer('nonexistent', 'socket1');
      }).not.toThrow();
    });
  });

  describe('disconnectPlayer', () => {
    test('marks player as disconnected', () => {
      gameState.disconnectPlayer(roomCode, 'socket1');

      const state = gameState.getGameState(roomCode);
      const player = state.players.find(p => p.socketId === 'socket1');
      expect(player.connected).toBe(false);
    });

    test('does nothing if player not found', () => {
      expect(() => {
        gameState.disconnectPlayer(roomCode, 'nonexistent');
      }).not.toThrow();
    });

    test('does nothing if room not found', () => {
      expect(() => {
        gameState.disconnectPlayer('nonexistent', 'socket1');
      }).not.toThrow();
    });
  });

  describe('reconnectPlayer', () => {
    beforeEach(() => {
      gameState.pairPlayers(roomCode, 'socket1', 'socket2');
      gameState.startGame(roomCode);
      gameState.disconnectPlayer(roomCode, 'socket1');
    });

    test('reconnects player with new socket ID', () => {
      gameState.reconnectPlayer(roomCode, 'Alice', 'new-socket-1');

      const state = gameState.getGameState(roomCode);
      const player = state.players.find(p => p.name === 'Alice');
      expect(player.socketId).toBe('new-socket-1');
      expect(player.connected).toBe(true);
    });

    test('updates partner reference to new socket ID', () => {
      gameState.reconnectPlayer(roomCode, 'Alice', 'new-socket-1');

      const state = gameState.getGameState(roomCode);
      const bob = state.players.find(p => p.name === 'Bob');
      expect(bob.partnerId).toBe('new-socket-1');
    });

    test('updates team references to new socket ID', () => {
      gameState.reconnectPlayer(roomCode, 'Alice', 'new-socket-1');

      const state = gameState.getGameState(roomCode);
      const team = state.teams.find(t => t.player1Id === 'new-socket-1' || t.player2Id === 'new-socket-1');
      expect(team).toBeDefined();
      expect(team.player1Id).toBe('new-socket-1');
    });

    test('throws error if room not found', () => {
      expect(() => {
        gameState.reconnectPlayer('nonexistent', 'Alice', 'new-socket');
      }).toThrow('Game not initialized');
    });

    test('throws error if player not found', () => {
      expect(() => {
        gameState.reconnectPlayer(roomCode, 'NonexistentPlayer', 'new-socket');
      }).toThrow('Player not found');
    });
  });

  describe('getDisconnectedPlayers', () => {
    test('returns empty array when all players connected', () => {
      const disconnected = gameState.getDisconnectedPlayers(roomCode);
      expect(disconnected).toEqual([]);
    });

    test('returns disconnected player names', () => {
      gameState.disconnectPlayer(roomCode, 'socket1');
      gameState.disconnectPlayer(roomCode, 'socket2');

      const disconnected = gameState.getDisconnectedPlayers(roomCode);
      expect(disconnected).toHaveLength(2);
      expect(disconnected).toEqual([
        { name: 'Alice' },
        { name: 'Bob' }
      ]);
    });

    test('returns empty array if room not found', () => {
      const disconnected = gameState.getDisconnectedPlayers('nonexistent');
      expect(disconnected).toEqual([]);
    });
  });

  describe('disconnectHost', () => {
    test('marks host as disconnected', () => {
      gameState.disconnectHost(roomCode);

      const state = gameState.getGameState(roomCode);
      expect(state.host.connected).toBe(false);
    });

    test('does nothing if room not found', () => {
      expect(() => {
        gameState.disconnectHost('nonexistent');
      }).not.toThrow();
    });

    test('does nothing if no host', () => {
      const newRoom = 'test2';
      gameState.initializeGame(newRoom);

      expect(() => {
        gameState.disconnectHost(newRoom);
      }).not.toThrow();
    });
  });

  describe('reconnectHost', () => {
    beforeEach(() => {
      gameState.disconnectHost(roomCode);
    });

    test('reconnects host with new socket ID', () => {
      gameState.reconnectHost(roomCode, 'new-host-socket');

      const state = gameState.getGameState(roomCode);
      expect(state.host.socketId).toBe('new-host-socket');
      expect(state.host.connected).toBe(true);
    });

    test('throws error if room not found', () => {
      expect(() => {
        gameState.reconnectHost('nonexistent', 'new-socket');
      }).toThrow('Host not found');
    });

    test('throws error if no host', () => {
      const newRoom = 'test2';
      gameState.initializeGame(newRoom);

      expect(() => {
        gameState.reconnectHost(newRoom, 'new-socket');
      }).toThrow('Host not found');
    });
  });

  describe('canJoinAsNew', () => {
    test('returns true when game in lobby', () => {
      expect(gameState.canJoinAsNew(roomCode)).toBe(true);
    });

    test('returns false when game started', () => {
      gameState.pairPlayers(roomCode, 'socket1', 'socket2');
      gameState.startGame(roomCode);

      expect(gameState.canJoinAsNew(roomCode)).toBe(false);
    });

    test('returns falsy value when room not found', () => {
      expect(gameState.canJoinAsNew('nonexistent')).toBeFalsy();
    });
  });

  describe('addPlayer edge cases', () => {
    test('throws error when adding duplicate player name', () => {
      expect(() => {
        gameState.addPlayer(roomCode, 'socket3', 'Alice', false);
      }).toThrow('Player name already exists');
    });

    test('throws error when game not initialized', () => {
      expect(() => {
        gameState.addPlayer('nonexistent', 'socket', 'Test', false);
      }).toThrow('Game not initialized');
    });
  });

  describe('player avatar', () => {
    test('assigns avatar with color and emoji when player is added', () => {
      const state = gameState.getGameState(roomCode);
      const alice = state.players.find(p => p.name === 'Alice');

      expect(alice.avatar).toBeDefined();
      expect(alice.avatar.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(alice.avatar.emoji).toBeDefined();
      expect(typeof alice.avatar.emoji).toBe('string');
    });

    test('each player gets their own avatar', () => {
      const state = gameState.getGameState(roomCode);
      const alice = state.players.find(p => p.name === 'Alice');
      const bob = state.players.find(p => p.name === 'Bob');

      // Both have avatars (they may or may not be the same due to randomness)
      expect(alice.avatar).toBeDefined();
      expect(bob.avatar).toBeDefined();
    });
  });

  describe('randomizePlayerAvatar', () => {
    test('changes player avatar', () => {
      const stateBefore = gameState.getGameState(roomCode);
      const aliceBefore = stateBefore.players.find(p => p.name === 'Alice');
      const originalAvatar = { ...aliceBefore.avatar };

      // Randomize multiple times to ensure at least one change (due to randomness)
      let changed = false;
      for (let i = 0; i < 10; i++) {
        gameState.randomizePlayerAvatar(roomCode, 'socket1');
        const stateAfter = gameState.getGameState(roomCode);
        const aliceAfter = stateAfter.players.find(p => p.name === 'Alice');

        if (aliceAfter.avatar.color !== originalAvatar.color ||
            aliceAfter.avatar.emoji !== originalAvatar.emoji) {
          changed = true;
          break;
        }
      }

      expect(changed).toBe(true);
    });

    test('returns the new avatar', () => {
      const newAvatar = gameState.randomizePlayerAvatar(roomCode, 'socket1');

      expect(newAvatar).toBeDefined();
      expect(newAvatar.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(newAvatar.emoji).toBeDefined();
    });

    test('throws error if game not initialized', () => {
      expect(() => {
        gameState.randomizePlayerAvatar('nonexistent', 'socket1');
      }).toThrow('Game not initialized');
    });

    test('throws error if player not found', () => {
      expect(() => {
        gameState.randomizePlayerAvatar(roomCode, 'nonexistent-socket');
      }).toThrow('Player not found');
    });
  });
});

describe('GameState - Team Management', () => {
  const roomCode = 'test';

  beforeEach(() => {
    gameState.initializeGame(roomCode);
    gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
    gameState.addPlayer(roomCode, 'socket1', 'Alice', false);
    gameState.addPlayer(roomCode, 'socket2', 'Bob', false);
    gameState.addPlayer(roomCode, 'socket3', 'Charlie', false);
    gameState.addPlayer(roomCode, 'socket4', 'Diana', false);
  });

  describe('unpairPlayers', () => {
    beforeEach(() => {
      gameState.pairPlayers(roomCode, 'socket1', 'socket2');
    });

    test('removes partnership between players', () => {
      gameState.unpairPlayers(roomCode, 'socket1');

      const state = gameState.getGameState(roomCode);
      const alice = state.players.find(p => p.name === 'Alice');
      const bob = state.players.find(p => p.name === 'Bob');

      expect(alice.partnerId).toBeNull();
      expect(alice.teamId).toBeNull();
      expect(bob.partnerId).toBeNull();
      expect(bob.teamId).toBeNull();
    });

    test('removes team from teams array', () => {
      const stateBefore = gameState.getGameState(roomCode);
      expect(stateBefore.teams).toHaveLength(1);

      gameState.unpairPlayers(roomCode, 'socket1');

      const stateAfter = gameState.getGameState(roomCode);
      expect(stateAfter.teams).toHaveLength(0);
    });

    test('can be called with either player in pair', () => {
      gameState.unpairPlayers(roomCode, 'socket2');

      const state = gameState.getGameState(roomCode);
      expect(state.teams).toHaveLength(0);
    });

    test('does nothing if player not found', () => {
      expect(() => {
        gameState.unpairPlayers(roomCode, 'nonexistent');
      }).not.toThrow();
    });

    test('does nothing if player not paired', () => {
      expect(() => {
        gameState.unpairPlayers(roomCode, 'socket3');
      }).not.toThrow();
    });

    test('does nothing if room not found', () => {
      expect(() => {
        gameState.unpairPlayers('nonexistent', 'socket1');
      }).not.toThrow();
    });
  });

  describe('pairPlayers edge cases', () => {
    test('throws error if player already paired', () => {
      gameState.pairPlayers(roomCode, 'socket1', 'socket2');

      expect(() => {
        gameState.pairPlayers(roomCode, 'socket1', 'socket3');
      }).toThrow('One or both players already paired');
    });

    test('throws error if player not found', () => {
      expect(() => {
        gameState.pairPlayers(roomCode, 'socket1', 'nonexistent');
      }).toThrow('One or both players not found');
    });

    test('throws error if game not initialized', () => {
      expect(() => {
        gameState.pairPlayers('nonexistent', 'socket1', 'socket2');
      }).toThrow('Game not initialized');
    });
  });
});

describe('GameState - Game Lifecycle', () => {
  const roomCode = 'test';

  beforeEach(() => {
    gameState.initializeGame(roomCode);
    gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
    gameState.addPlayer(roomCode, 'socket1', 'Alice', false);
    gameState.addPlayer(roomCode, 'socket2', 'Bob', false);
    gameState.pairPlayers(roomCode, 'socket1', 'socket2');
  });

  describe('startGame edge cases', () => {
    test('throws error if already started', () => {
      gameState.startGame(roomCode);

      expect(() => {
        gameState.startGame(roomCode);
      }).toThrow('Game already started');
    });

    test('throws error if no teams formed', () => {
      const newRoom = 'test2';
      gameState.initializeGame(newRoom);
      gameState.addPlayer(newRoom, 'host', 'Host', true);

      expect(() => {
        gameState.startGame(newRoom);
      }).toThrow('No teams formed');
    });

    test('throws error if game not initialized', () => {
      expect(() => {
        gameState.startGame('nonexistent');
      }).toThrow('Game not initialized');
    });
  });

  describe('endGame', () => {
    beforeEach(() => {
      gameState.startGame(roomCode);
    });

    test('changes status to ended', () => {
      gameState.endGame(roomCode);

      const state = gameState.getGameState(roomCode);
      expect(state.status).toBe('ended');
    });

    test('throws error if game not initialized', () => {
      expect(() => {
        gameState.endGame('nonexistent');
      }).toThrow('Game not initialized');
    });

    test('throws error if game not started', () => {
      const newRoom = 'test2';
      gameState.initializeGame(newRoom);

      expect(() => {
        gameState.endGame(newRoom);
      }).toThrow('Cannot end game that has not started');
    });

    test('throws error if already ended', () => {
      gameState.endGame(roomCode);

      expect(() => {
        gameState.endGame(roomCode);
      }).toThrow('Game already ended');
    });
  });
});

describe('GameState - Round Validation', () => {
  const roomCode = 'test';

  beforeEach(() => {
    gameState.initializeGame(roomCode);
    gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
    gameState.addPlayer(roomCode, 'socket1', 'Alice', false);
    gameState.addPlayer(roomCode, 'socket2', 'Bob', false);
    gameState.pairPlayers(roomCode, 'socket1', 'socket2');
    gameState.startGame(roomCode);
  });

  describe('startRound validation', () => {
    test('throws error for invalid variant', () => {
      expect(() => {
        gameState.startRound(roomCode, 'Test?', 'invalid_variant', null);
      }).toThrow('Invalid variant type');
    });

    test('throws error for multiple_choice without options', () => {
      expect(() => {
        gameState.startRound(roomCode, 'Test?', 'multiple_choice', null);
      }).toThrow('Multiple choice requires 2-6 options');
    });

    test('throws error for multiple_choice with too few options', () => {
      expect(() => {
        gameState.startRound(roomCode, 'Test?', 'multiple_choice', ['Only one']);
      }).toThrow('Multiple choice requires 2-6 options');
    });

    test('throws error for multiple_choice with too many options', () => {
      expect(() => {
        gameState.startRound(roomCode, 'Test?', 'multiple_choice', ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
      }).toThrow('Multiple choice requires 2-6 options');
    });

    test('throws error for binary without options', () => {
      expect(() => {
        gameState.startRound(roomCode, 'Test?', 'binary', null);
      }).toThrow('Binary requires exactly 2 options');
    });

    test('throws error for binary with wrong number of options', () => {
      expect(() => {
        gameState.startRound(roomCode, 'Test?', 'binary', ['Yes', 'No', 'Maybe']);
      }).toThrow('Binary requires exactly 2 options');
    });

    test('throws error for open_ended with options', () => {
      expect(() => {
        gameState.startRound(roomCode, 'Test?', 'open_ended', ['Should not have']);
      }).toThrow('Open ended should not have options');
    });

    test('accepts valid multiple_choice with 2 options', () => {
      expect(() => {
        gameState.startRound(roomCode, 'Test?', 'multiple_choice', ['A', 'B']);
      }).not.toThrow();
    });

    test('accepts valid binary with 2 options', () => {
      expect(() => {
        gameState.startRound(roomCode, 'Test?', 'binary', ['Yes', 'No']);
      }).not.toThrow();
    });

    test('throws error if game not initialized', () => {
      expect(() => {
        gameState.startRound('nonexistent', 'Test?', 'open_ended', null);
      }).toThrow('Game not initialized');
    });
  });

  describe('submitAnswer edge cases', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Test question', 'open_ended', null);
    });

    test('throws error if no active round', () => {
      const newRoom = 'test2';
      gameState.initializeGame(newRoom);
      gameState.addPlayer(newRoom, 'host', 'Host', true);

      expect(() => {
        gameState.submitAnswer(newRoom, 'host', 'Answer');
      }).toThrow('No active round');
    });

    test('throws error if round not accepting answers', () => {
      gameState.submitAnswer(roomCode, 'socket1', 'Answer1');
      gameState.submitAnswer(roomCode, 'socket2', 'Answer2');
      gameState.completeRound(roomCode);

      expect(() => {
        gameState.submitAnswer(roomCode, 'socket1', 'New answer');
      }).toThrow('Round not accepting answers');
    });

    test('throws error if player not found', () => {
      expect(() => {
        gameState.submitAnswer(roomCode, 'nonexistent-socket', 'Answer');
      }).toThrow('Player not found');
    });
  });

  describe('completeRound edge cases', () => {
    test('throws error if no active round', () => {
      expect(() => {
        gameState.completeRound(roomCode);
      }).toThrow('No active round');
    });

    test('throws error if game not initialized', () => {
      expect(() => {
        gameState.completeRound('nonexistent');
      }).toThrow('No active round');
    });
  });

  describe('returnToAnswering edge cases', () => {
    test('throws error if game not initialized', () => {
      expect(() => {
        gameState.returnToAnswering('nonexistent');
      }).toThrow('Game not initialized');
    });

    test('throws error if no active round', () => {
      expect(() => {
        gameState.returnToAnswering(roomCode);
      }).toThrow('No active round');
    });
  });
});

describe('GameState - Scoring Functions', () => {
  const roomCode = 'test';

  beforeEach(() => {
    gameState.initializeGame(roomCode);
    gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
    gameState.addPlayer(roomCode, 'socket1', 'Alice', false);
    gameState.addPlayer(roomCode, 'socket2', 'Bob', false);
    gameState.addPlayer(roomCode, 'socket3', 'Charlie', false);
    gameState.addPlayer(roomCode, 'socket4', 'Diana', false);
    gameState.pairPlayers(roomCode, 'socket1', 'socket2');
    gameState.pairPlayers(roomCode, 'socket3', 'socket4');
    gameState.startGame(roomCode);
  });

  describe('updateTeamScore', () => {
    test('adds points to team score', () => {
      const team = gameState.getGameState(roomCode).teams[0];

      gameState.updateTeamScore(roomCode, team.teamId, 5);

      const state = gameState.getGameState(roomCode);
      expect(state.teams[0].score).toBe(5);
    });

    test('can add negative points', () => {
      const team = gameState.getGameState(roomCode).teams[0];
      gameState.updateTeamScore(roomCode, team.teamId, 10);
      gameState.updateTeamScore(roomCode, team.teamId, -3);

      const state = gameState.getGameState(roomCode);
      expect(state.teams[0].score).toBe(7);
    });

    test('throws error if game not initialized', () => {
      expect(() => {
        gameState.updateTeamScore('nonexistent', 'team-id', 5);
      }).toThrow('Game not initialized');
    });

    test('throws error if team not found', () => {
      expect(() => {
        gameState.updateTeamScore(roomCode, 'nonexistent-team', 5);
      }).toThrow('Team not found');
    });
  });

  describe('getPlayerTeams', () => {
    beforeEach(() => {
      gameState.startRound(roomCode, 'Test question', 'open_ended', null);
      gameState.submitAnswer(roomCode, 'socket1', 'Alice answer', 2000);
      gameState.submitAnswer(roomCode, 'socket2', 'Bob answer', 3000);
      gameState.submitAnswer(roomCode, 'socket3', 'Charlie answer', 1500);
      gameState.submitAnswer(roomCode, 'socket4', 'Diana answer', 2500);
    });

    test('returns teams with player info and answers', () => {
      const teams = gameState.getPlayerTeams(roomCode);

      expect(teams).toHaveLength(2);
      expect(teams[0]).toEqual({
        teamId: expect.any(String),
        score: 0,
        player1: {
          socketId: 'socket1',
          name: 'Alice',
          answer: { text: 'Alice answer', responseTime: 2000 }
        },
        player2: {
          socketId: 'socket2',
          name: 'Bob',
          answer: { text: 'Bob answer', responseTime: 3000 }
        }
      });
    });

    test('returns null for answers when no round', () => {
      const newRoom = 'test2';
      gameState.initializeGame(newRoom);
      gameState.addPlayer(newRoom, 'host', 'Host', true);
      gameState.addPlayer(newRoom, 's1', 'P1', false);
      gameState.addPlayer(newRoom, 's2', 'P2', false);
      gameState.pairPlayers(newRoom, 's1', 's2');

      const teams = gameState.getPlayerTeams(newRoom);

      expect(teams[0].player1.answer).toBeNull();
      expect(teams[0].player2.answer).toBeNull();
    });

    test('returns empty array if game not found', () => {
      const teams = gameState.getPlayerTeams('nonexistent');
      expect(teams).toEqual([]);
    });

    test('includes team scores', () => {
      const team = gameState.getGameState(roomCode).teams[0];
      gameState.updateTeamScore(roomCode, team.teamId, 15);

      const teams = gameState.getPlayerTeams(roomCode);
      const updatedTeam = teams.find(t => t.teamId === team.teamId);
      expect(updatedTeam.score).toBe(15);
    });
  });

  describe('setCurrentRoundId', () => {
    test('sets round ID after DB persistence', () => {
      gameState.startRound(roomCode, 'Test', 'open_ended', null);
      gameState.setCurrentRoundId(roomCode, 42);

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.roundId).toBe(42);
    });

    test('does nothing if no current round', () => {
      expect(() => {
        gameState.setCurrentRoundId(roomCode, 42);
      }).not.toThrow();
    });

    test('does nothing if game not found', () => {
      expect(() => {
        gameState.setCurrentRoundId('nonexistent', 42);
      }).not.toThrow();
    });
  });

  describe('returnToPlaying', () => {
    test('changes status back to playing', () => {
      gameState.startRound(roomCode, 'Test', 'open_ended', null);
      gameState.submitAnswer(roomCode, 'socket1', 'A1');
      gameState.submitAnswer(roomCode, 'socket2', 'A2');
      gameState.submitAnswer(roomCode, 'socket3', 'A3');
      gameState.submitAnswer(roomCode, 'socket4', 'A4');
      gameState.completeRound(roomCode);

      expect(gameState.getGameState(roomCode).status).toBe('scoring');

      gameState.returnToPlaying(roomCode);

      expect(gameState.getGameState(roomCode).status).toBe('playing');
    });

    test('does nothing if room not found', () => {
      expect(() => {
        gameState.returnToPlaying('nonexistent');
      }).not.toThrow();
    });
  });
});

describe('GameState - Room Management', () => {
  describe('hasRoom', () => {
    test('returns true for existing room', () => {
      gameState.initializeGame('test-room');
      expect(gameState.hasRoom('test-room')).toBe(true);
    });

    test('returns false for non-existent room', () => {
      expect(gameState.hasRoom('nonexistent')).toBe(false);
    });
  });

  describe('deleteRoom', () => {
    test('removes room from state', () => {
      gameState.initializeGame('test-room');
      expect(gameState.hasRoom('test-room')).toBe(true);

      gameState.deleteRoom('test-room');

      expect(gameState.hasRoom('test-room')).toBe(false);
    });

    test('does not throw if room does not exist', () => {
      expect(() => {
        gameState.deleteRoom('nonexistent');
      }).not.toThrow();
    });
  });

  describe('getRoomCodes', () => {
    test('returns array of all room codes', () => {
      gameState.initializeGame('room1');
      gameState.initializeGame('room2');
      gameState.initializeGame('room3');

      const codes = gameState.getRoomCodes();

      expect(codes).toContain('room1');
      expect(codes).toContain('room2');
      expect(codes).toContain('room3');
      expect(codes.length).toBeGreaterThanOrEqual(3);
    });

    test('returns empty array when no rooms', () => {
      // Clean up all rooms
      const codes = gameState.getRoomCodes();
      codes.forEach(code => gameState.deleteRoom(code));

      expect(gameState.getRoomCodes()).toEqual([]);
    });
  });

  describe('getAllGames', () => {
    beforeEach(() => {
      // Clean up all existing rooms
      const codes = gameState.getRoomCodes();
      codes.forEach(code => gameState.deleteRoom(code));
    });

    test('returns all active games', () => {
      gameState.initializeGame('room1');
      gameState.initializeGame('room2');

      const games = gameState.getAllGames();

      expect(games).toHaveLength(2);
      expect(games[0].status).not.toBe('ended');
      expect(games[1].status).not.toBe('ended');
    });

    test('excludes ended games', () => {
      gameState.initializeGame('room1');
      gameState.addPlayer('room1', 'host', 'Host', true);
      gameState.addPlayer('room1', 's1', 'P1', false);
      gameState.addPlayer('room1', 's2', 'P2', false);
      gameState.pairPlayers('room1', 's1', 's2');
      gameState.startGame('room1');
      gameState.endGame('room1');

      gameState.initializeGame('room2');

      const games = gameState.getAllGames();

      expect(games).toHaveLength(1);
      expect(games[0].roomCode).toBe('room2');
    });

    test('returns empty array when no games', () => {
      const games = gameState.getAllGames();
      expect(games).toEqual([]);
    });
  });
});
