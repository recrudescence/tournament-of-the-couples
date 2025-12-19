// Mock uuid before requiring modules
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9))
}));

const gameState = require('../gameState');
const { handleHostJoin, handlePlayerReconnect, handleNewPlayerJoin } = require('../joinHandlers');

describe('Join Handlers', () => {
  let mockSocket;
  let mockState;

  beforeEach(() => {
    // Reset game state
    gameState.initializeGame();

    // Mock socket
    mockSocket = {
      id: 'socket-123',
      emit: jest.fn()
    };

    // Get fresh state
    mockState = gameState.getGameState();
  });

  describe('handleHostJoin', () => {
    test('successfully reconnects existing host', () => {
      // Set up existing host
      mockState.host = { socketId: 'old-socket-id', name: 'HostName' };

      const result = handleHostJoin(mockSocket, 'HostName', mockState);

      expect(result.success).toBe(true);
      expect(result.data.isHost).toBe(true);
      expect(result.data.reconnected).toBe(true);
      expect(result.data.socketId).toBe('socket-123');
      expect(mockState.host.socketId).toBe('socket-123'); // Socket ID updated
    });

    test('returns error when host name does not match', () => {
      // Set up existing host with different name
      mockState.host = { socketId: 'old-socket-id', name: 'OriginalHost' };

      const result = handleHostJoin(mockSocket, 'DifferentHost', mockState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Host name does not match');
    });

    test('returns error when no host exists', () => {
      mockState.host = null;

      const result = handleHostJoin(mockSocket, 'NewHost', mockState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Host name does not match');
    });

    test('includes full gameState in response', () => {
      mockState.host = { socketId: 'old-socket-id', name: 'HostName' };

      const result = handleHostJoin(mockSocket, 'HostName', mockState);

      expect(result.data.gameState).toBeDefined();
      expect(result.data.gameState).toBe(mockState);
    });
  });

  describe('handlePlayerReconnect', () => {
    beforeEach(() => {
      // Add some players
      gameState.addPlayer('socket-1', 'Alice', false);
      gameState.addPlayer('socket-2', 'Bob', false);

      // Disconnect Alice
      gameState.disconnectPlayer('socket-1');

      mockState = gameState.getGameState();
    });

    test('successfully reconnects disconnected player', () => {
      const result = handlePlayerReconnect(mockSocket, 'Alice', mockState);

      expect(result.success).toBe(true);
      expect(result.data.reconnected).toBe(true);
      expect(result.data.isHost).toBe(false);
      expect(result.data.player.name).toBe('Alice');
      expect(result.data.player.connected).toBe(true);

      // Verify socket ID was updated in gameState
      const alice = mockState.players.find(p => p.name === 'Alice');
      expect(alice.socketId).toBe('socket-123');
    });

    test('returns error when player not found', () => {
      const result = handlePlayerReconnect(mockSocket, 'NonExistent', mockState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Player not found');
    });

    test('returns error when player is already connected', () => {
      const result = handlePlayerReconnect(mockSocket, 'Bob', mockState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Player name already exists');
    });

    test('includes gameState in response', () => {
      const result = handlePlayerReconnect(mockSocket, 'Alice', mockState);

      expect(result.data.gameState).toBeDefined();
      expect(result.data.gameState).toBe(mockState);
    });
  });

  describe('handleNewPlayerJoin', () => {
    test('successfully adds new player in lobby', () => {
      // Game is in lobby by default
      expect(mockState.status).toBe('lobby');

      const result = handleNewPlayerJoin(mockSocket, 'NewPlayer', false, mockState);

      expect(result.success).toBe(true);
      expect(result.data.socketId).toBe('socket-123');
      expect(result.data.name).toBe('NewPlayer');
      expect(result.data.isHost).toBe(false);

      // Verify player was added
      const updatedState = gameState.getGameState();
      const newPlayer = updatedState.players.find(p => p.name === 'NewPlayer');
      expect(newPlayer).toBeDefined();
      expect(newPlayer.socketId).toBe('socket-123');
    });

    test('returns error when game is in progress', () => {
      // Start the game
      gameState.addPlayer('socket-1', 'Alice', false);
      gameState.addPlayer('socket-2', 'Bob', false);
      gameState.pairPlayers('socket-1', 'socket-2');
      gameState.startGame();

      mockState = gameState.getGameState();

      const result = handleNewPlayerJoin(mockSocket, 'NewPlayer', false, mockState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot join game in progress');
    });

    test('returns error when player name already exists', () => {
      gameState.addPlayer('socket-1', 'Alice', false);
      mockState = gameState.getGameState();

      const result = handleNewPlayerJoin(mockSocket, 'Alice', false, mockState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Player name already exists');
    });

    test('supports joining as host (for initial setup)', () => {
      const result = handleNewPlayerJoin(mockSocket, 'HostPlayer', true, mockState);

      expect(result.success).toBe(true);
      expect(result.data.isHost).toBe(true);
    });

    test('returns updated gameState after adding player', () => {
      const result = handleNewPlayerJoin(mockSocket, 'NewPlayer', false, mockState);

      expect(result.success).toBe(true);
      expect(result.data.gameState).toBeDefined();
      expect(result.data.gameState.players.length).toBe(1);
    });
  });

  describe('Integration: Join Flow Scenarios', () => {
    test('Scenario: Host joins, then players join, then one player disconnects and reconnects', () => {
      // 1. Host joins
      let hostSocket = { id: 'host-socket-1' };
      gameState.addPlayer(hostSocket.id, 'Host', true);
      let state = gameState.getGameState();

      expect(state.host.name).toBe('Host');

      // 2. Players join
      let player1Socket = { id: 'player-socket-1' };
      let result1 = handleNewPlayerJoin(player1Socket, 'Alice', false, state);
      expect(result1.success).toBe(true);

      let player2Socket = { id: 'player-socket-2' };
      state = gameState.getGameState();
      let result2 = handleNewPlayerJoin(player2Socket, 'Bob', false, state);
      expect(result2.success).toBe(true);

      // 3. Alice disconnects
      gameState.disconnectPlayer('player-socket-1');
      state = gameState.getGameState();

      const alice = state.players.find(p => p.name === 'Alice');
      expect(alice.connected).toBe(false);

      // 4. Alice reconnects with new socket
      let newAliceSocket = { id: 'player-socket-3' };
      let reconnectResult = handlePlayerReconnect(newAliceSocket, 'Alice', state);

      expect(reconnectResult.success).toBe(true);
      expect(reconnectResult.data.player.socketId).toBe('player-socket-3');
      expect(reconnectResult.data.player.connected).toBe(true);
    });

    test('Scenario: Host refreshes page during game (page navigation)', () => {
      // Set up game with host
      mockState.host = { socketId: 'old-host-socket', name: 'Host' };

      // Host navigates to new page, gets new socket ID
      let newHostSocket = { id: 'new-host-socket' };

      const result = handleHostJoin(newHostSocket, 'Host', mockState);

      expect(result.success).toBe(true);
      expect(result.data.reconnected).toBe(true);
      expect(mockState.host.socketId).toBe('new-host-socket');
    });

    test('Scenario: Player tries to join with existing name during game', () => {
      // Set up game in progress
      gameState.addPlayer('socket-1', 'Alice', false);
      gameState.addPlayer('socket-2', 'Bob', false);
      gameState.pairPlayers('socket-1', 'socket-2');
      gameState.startGame();

      const state = gameState.getGameState();

      // New player tries to join with existing name during game
      let duplicateSocket = { id: 'socket-3' };
      const result = handleNewPlayerJoin(duplicateSocket, 'Alice', false, state);

      expect(result.success).toBe(false);
      // Game in progress check takes priority over duplicate name check
      expect(result.error).toBe('Cannot join game in progress');
    });

    test('Scenario: Implicit reconnect (player joins without isReconnect flag)', () => {
      // Set up: Alice was connected, then disconnected
      gameState.addPlayer('socket-1', 'Alice', false);
      gameState.disconnectPlayer('socket-1');

      const state = gameState.getGameState();

      // In socketHandlers, this would be detected and routed to handlePlayerReconnect
      const existingPlayer = state.players.find(p => p.name === 'Alice');
      expect(existingPlayer).toBeDefined();
      expect(existingPlayer.connected).toBe(false);

      // Reconnect via handlePlayerReconnect (implicit)
      let newSocket = { id: 'socket-2' };
      const result = handlePlayerReconnect(newSocket, 'Alice', state);

      expect(result.success).toBe(true);
      expect(result.data.reconnected).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('handles gameState module throwing errors', () => {
      // Mock gameState.addPlayer to throw
      const originalAddPlayer = gameState.addPlayer;
      gameState.addPlayer = jest.fn(() => {
        throw new Error('Database error');
      });

      expect(() => {
        handleNewPlayerJoin(mockSocket, 'TestPlayer', false, mockState);
      }).toThrow('Database error');

      // Restore
      gameState.addPlayer = originalAddPlayer;
    });

    test('returns consistent error format', () => {
      const error1 = handleHostJoin(mockSocket, 'Wrong', mockState);
      const error2 = handlePlayerReconnect(mockSocket, 'NotFound', mockState);

      expect(error1).toHaveProperty('success', false);
      expect(error1).toHaveProperty('error');
      expect(typeof error1.error).toBe('string');

      expect(error2).toHaveProperty('success', false);
      expect(error2).toHaveProperty('error');
      expect(typeof error2.error).toBe('string');
    });
  });
});
