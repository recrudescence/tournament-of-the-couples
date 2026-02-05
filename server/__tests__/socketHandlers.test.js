// Mock dependencies before requiring socketHandlers
jest.mock('../roomCodeGenerator', () => ({
  generateRoomCode: jest.fn(() => 'test'),
  generateTeamCode: jest.fn(() => 'team'),
  validateRoomCode: jest.fn((code) => typeof code === 'string' && code.length > 0),
  markRoomInactive: jest.fn(),
}));

jest.mock('../database', () => ({
  createGame: jest.fn(() => Promise.resolve()),
  saveRound: jest.fn(() => Promise.resolve(1)),
  getRoundCount: jest.fn(() => Promise.resolve(0)),
  saveAnswer: jest.fn(() => Promise.resolve(1)),
}));

jest.mock('../botManager', () => ({
  isBot: jest.fn((socketId) => typeof socketId === 'string' && socketId.startsWith('bot-')),
  addBots: jest.fn(() => []),
  removeAllBots: jest.fn(),
  scheduleBotAnswers: jest.fn(),
  cancelBotTimers: jest.fn(),
}));

const gameState = require('../gameState');
const { setupSocketHandlers } = require('../socketHandlers');

describe('socketHandlers', () => {
  let io;
  let socket;
  let roomCode;

  beforeEach(() => {
    // Clear all game state before each test
    const roomCodes = gameState.getRoomCodes();
    roomCodes.forEach(code => gameState.deleteRoom(code));

    roomCode = 'test';

    // Mock socket
    socket = {
      id: 'socket-123',
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      roomCode: null,
      on: jest.fn(),
    };

    // Create shared mock for room emissions
    const mockRoomEmit = jest.fn();

    // Mock io
    io = {
      on: jest.fn((event, handler) => {
        // Store the connection handler
        if (event === 'connection') {
          io.connectionHandler = handler;
        }
      }),
      to: jest.fn(() => ({
        emit: mockRoomEmit,
      })),
      sockets: {
        sockets: {
          get: jest.fn(() => null),
        },
      },
    };

    // Store reference to room emit for test assertions
    io.roomEmit = mockRoomEmit;

    // Set up socket handlers
    setupSocketHandlers(io);
  });

  describe('createGame', () => {
    it('should create a new game and emit gameCreated', async () => {
      const name = 'Alice';

      // Find the createGame handler
      io.connectionHandler(socket);
      const createGameHandler = socket.on.mock.calls.find(
        call => call[0] === 'createGame'
      )[1];

      await createGameHandler({ name });

      expect(socket.join).toHaveBeenCalledWith('test');
      expect(socket.roomCode).toBe('test');
      expect(socket.emit).toHaveBeenCalledWith(
        'gameCreated',
        expect.objectContaining({
          roomCode: 'test',
          name: 'Alice',
          isHost: true,
          gameState: expect.objectContaining({
            roomCode: 'test',
            status: 'lobby',
            host: expect.objectContaining({
              name: 'Alice',
              socketId: 'socket-123',
            }),
          }),
        })
      );
    });

    it('should handle errors during game creation', async () => {
      const database = require('../database');
      database.createGame.mockRejectedValueOnce(new Error('Database error'));

      io.connectionHandler(socket);
      const createGameHandler = socket.on.mock.calls.find(
        call => call[0] === 'createGame'
      )[1];

      await createGameHandler({ name: 'Alice' });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: expect.stringContaining('Database error'),
        })
      );
    });
  });

  describe('joinGame', () => {
    beforeEach(() => {
      // Initialize a game for joining tests
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
    });

    it('should allow new player to join lobby game', async () => {
      io.connectionHandler(socket);
      const joinGameHandler = socket.on.mock.calls.find(
        call => call[0] === 'joinGame'
      )[1];

      await joinGameHandler({
        name: 'Bob',
        isHost: false,
        isReconnect: false,
        roomCode: 'test',
      });

      expect(socket.join).toHaveBeenCalledWith('test');
      expect(socket.emit).toHaveBeenCalledWith(
        'joinSuccess',
        expect.objectContaining({
          roomCode: 'test',
          name: 'Bob',
          isHost: false,
        })
      );

      const state = gameState.getGameState(roomCode);
      expect(state.players).toHaveLength(1);
      expect(state.players[0].name).toBe('Bob');
    });

    it('should reject join with invalid room code', async () => {
      io.connectionHandler(socket);
      const joinGameHandler = socket.on.mock.calls.find(
        call => call[0] === 'joinGame'
      )[1];

      await joinGameHandler({
        name: 'Bob',
        isHost: false,
        isReconnect: false,
        roomCode: '',
      });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Invalid room code',
        })
      );
    });

    it('should reject join to non-existent room', async () => {
      io.connectionHandler(socket);
      const joinGameHandler = socket.on.mock.calls.find(
        call => call[0] === 'joinGame'
      )[1];

      await joinGameHandler({
        name: 'Bob',
        isHost: false,
        isReconnect: false,
        roomCode: 'nonexistent',
      });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Room not found',
        })
      );
    });

    it('should allow host to reconnect', async () => {
      const state = gameState.getGameState(roomCode);
      state.host.connected = false;

      io.connectionHandler(socket);
      const joinGameHandler = socket.on.mock.calls.find(
        call => call[0] === 'joinGame'
      )[1];

      await joinGameHandler({
        name: 'Host',
        isHost: true,
        isReconnect: true,
        roomCode: 'test',
      });

      expect(socket.emit).toHaveBeenCalledWith(
        'joinSuccess',
        expect.objectContaining({
          roomCode: 'test',
          name: 'Host',
          isHost: true,
        })
      );

      const updatedState = gameState.getGameState(roomCode);
      expect(updatedState.host.connected).toBe(true);
    });
  });

  describe('requestPair', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
    });

    it('should pair two players successfully', () => {
      socket.roomCode = roomCode;
      socket.id = 'socket-1';

      io.connectionHandler(socket);
      const pairHandler = socket.on.mock.calls.find(
        call => call[0] === 'requestPair'
      )[1];

      pairHandler({ targetSocketId: 'socket-2' });

      const state = gameState.getGameState(roomCode);
      expect(state.teams).toHaveLength(1);
      expect(state.teams[0].player1Id).toBe('socket-1');
      expect(state.teams[0].player2Id).toBe('socket-2');
    });

    it('should reject pairing when not in a room', () => {
      io.connectionHandler(socket);
      const pairHandler = socket.on.mock.calls.find(
        call => call[0] === 'requestPair'
      )[1];

      pairHandler({ targetSocketId: 'socket-2' });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });

  describe('startGame', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
    });

    it('should start the game when all players are paired', () => {
      socket.roomCode = roomCode;

      io.connectionHandler(socket);
      const startGameHandler = socket.on.mock.calls.find(
        call => call[0] === 'startGame'
      )[1];

      startGameHandler({});

      const state = gameState.getGameState(roomCode);
      expect(state.status).toBe('playing');
      expect(io.to).toHaveBeenCalledWith(roomCode);
    });

    it('should reject start when not in a room', () => {
      io.connectionHandler(socket);
      const startGameHandler = socket.on.mock.calls.find(
        call => call[0] === 'startGame'
      )[1];

      startGameHandler({});

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });

  describe('startRound', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
      gameState.startGame(roomCode);
    });

    it('should start a new round with open-ended question', async () => {
      socket.roomCode = roomCode;

      io.connectionHandler(socket);
      const startRoundHandler = socket.on.mock.calls.find(
        call => call[0] === 'startRound'
      )[1];

      await startRoundHandler({
        question: 'What is your favorite color?',
        variant: 'open_ended',
        options: null,
      });

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound).not.toBeNull();
      expect(state.currentRound.question).toBe('What is your favorite color?');
      expect(state.currentRound.variant).toBe('open_ended');
      expect(io.to).toHaveBeenCalledWith(roomCode);
    });

    it('should start a round with multiple choice options', async () => {
      socket.roomCode = roomCode;

      io.connectionHandler(socket);
      const startRoundHandler = socket.on.mock.calls.find(
        call => call[0] === 'startRound'
      )[1];

      await startRoundHandler({
        question: 'Pick a color',
        variant: 'multiple_choice',
        options: ['Red', 'Blue', 'Green'],
      });

      const state = gameState.getGameState(roomCode);
      expect(state.currentRound.variant).toBe('multiple_choice');
      expect(state.currentRound.options).toEqual(['Red', 'Blue', 'Green']);
    });

    it('should reject starting round when not in a room', async () => {
      io.connectionHandler(socket);
      const startRoundHandler = socket.on.mock.calls.find(
        call => call[0] === 'startRound'
      )[1];

      await startRoundHandler({
        question: 'Test?',
        variant: 'open_ended',
        options: null,
      });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });

  describe('submitAnswer', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
      gameState.startGame(roomCode);
      gameState.startRound(roomCode, 'What is your favorite color?', 'open_ended', null);
    });

    it('should accept answer submission', () => {
      socket.roomCode = roomCode;
      socket.id = 'socket-1';

      const state = gameState.getGameState(roomCode);
      const player = state.players.find(p => p.socketId === 'socket-1');

      io.connectionHandler(socket);
      const submitAnswerHandler = socket.on.mock.calls.find(
        call => call[0] === 'submitAnswer'
      )[1];

      submitAnswerHandler({
        answer: 'Blue',
        responseTime: 3000,
      });

      const updatedState = gameState.getGameState(roomCode);
      expect(updatedState.currentRound.answers[player.name]).toBeDefined();
      expect(updatedState.currentRound.answers[player.name].text).toBe('Blue');
      expect(io.to).toHaveBeenCalledWith(roomCode);
    });

    it('should reject answer when not in a room', () => {
      io.connectionHandler(socket);
      const submitAnswerHandler = socket.on.mock.calls.find(
        call => call[0] === 'submitAnswer'
      )[1];

      submitAnswerHandler({
        answer: 'Blue',
        responseTime: 3000,
      });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });

  describe('disconnect', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
    });

    it('should remove player from lobby when they disconnect', () => {
      socket.roomCode = roomCode;
      socket.id = 'socket-1';

      io.connectionHandler(socket);
      const disconnectHandler = socket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )[1];

      disconnectHandler();

      const state = gameState.getGameState(roomCode);
      const player = state.players.find(p => p.socketId === 'socket-1');
      expect(player).toBeUndefined(); // Player should be completely removed
      expect(io.to).toHaveBeenCalledWith(roomCode);
      expect(io.roomEmit).toHaveBeenCalledWith('lobbyUpdate', expect.any(Object));
    });

    it('should cancel game when host disconnects from lobby', () => {
      jest.useFakeTimers();

      socket.roomCode = roomCode;
      socket.id = 'host-socket';

      io.connectionHandler(socket);
      const disconnectHandler = socket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )[1];

      disconnectHandler();

      // Host disconnect has a grace period - host is marked disconnected but game not deleted yet
      let state = gameState.getGameState(roomCode);
      expect(state).toBeDefined();
      expect(state.host.connected).toBe(false);

      // After grace period, game is deleted
      jest.advanceTimersByTime(5000);

      state = gameState.getGameState(roomCode);
      expect(state).toBeUndefined();
      expect(io.to).toHaveBeenCalledWith(roomCode);
      expect(io.roomEmit).toHaveBeenCalledWith('gameCancelled', { reason: 'Host disconnected' });

      jest.useRealTimers();
    });

    it('should mark player as disconnected during active game', () => {
      // Start the game
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
      gameState.startGame(roomCode);

      socket.roomCode = roomCode;
      socket.id = 'socket-1';

      io.connectionHandler(socket);
      const disconnectHandler = socket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )[1];

      disconnectHandler();

      const state = gameState.getGameState(roomCode);
      const player = state.players.find(p => p.socketId === 'socket-1');
      expect(player.connected).toBe(false); // Player marked as disconnected, not removed
      expect(io.to).toHaveBeenCalledWith(roomCode);
      expect(io.roomEmit).toHaveBeenCalledWith('playerDisconnected', { socketId: 'socket-1', name: 'Alice' });
    });
  });

  describe('unpair', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
    });

    it('should unpair players successfully', () => {
      socket.roomCode = roomCode;
      socket.id = 'socket-1';

      io.connectionHandler(socket);
      const unpairHandler = socket.on.mock.calls.find(
        call => call[0] === 'unpair'
      )[1];

      unpairHandler();

      const state = gameState.getGameState(roomCode);
      expect(state.teams).toHaveLength(0);
      const player1 = state.players.find(p => p.socketId === 'socket-1');
      const player2 = state.players.find(p => p.socketId === 'socket-2');
      expect(player1.partnerId).toBeNull();
      expect(player2.partnerId).toBeNull();
      expect(io.to).toHaveBeenCalledWith(roomCode);
    });

    it('should reject unpairing when not in a room', () => {
      io.connectionHandler(socket);
      const unpairHandler = socket.on.mock.calls.find(
        call => call[0] === 'unpair'
      )[1];

      unpairHandler();

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });

  describe('kickPlayer', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
    });

    it('should allow host to kick a player from lobby', () => {
      socket.roomCode = roomCode;
      socket.id = 'host-socket';

      io.connectionHandler(socket);
      const kickHandler = socket.on.mock.calls.find(
        call => call[0] === 'kickPlayer'
      )[1];

      kickHandler({ targetSocketId: 'socket-1' });

      const state = gameState.getGameState(roomCode);
      expect(state.players.find(p => p.socketId === 'socket-1')).toBeUndefined();
      expect(io.to).toHaveBeenCalledWith('socket-1');
      expect(io.roomEmit).toHaveBeenCalledWith('playerKicked');
    });

    it('should reject kick when not host', () => {
      socket.roomCode = roomCode;
      socket.id = 'socket-1';

      io.connectionHandler(socket);
      const kickHandler = socket.on.mock.calls.find(
        call => call[0] === 'kickPlayer'
      )[1];

      kickHandler({ targetSocketId: 'socket-1' });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Only the host can kick players',
        })
      );
    });

    it('should mark player as disconnected when kicked during game', () => {
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
      gameState.startGame(roomCode);

      socket.roomCode = roomCode;
      socket.id = 'host-socket';

      io.connectionHandler(socket);
      const kickHandler = socket.on.mock.calls.find(
        call => call[0] === 'kickPlayer'
      )[1];

      kickHandler({ targetSocketId: 'socket-1' });

      // During gameplay, kicked player is marked disconnected (not removed)
      const state = gameState.getGameState(roomCode);
      const kickedPlayer = state.players.find(p => p.socketId === 'socket-1');
      expect(kickedPlayer).toBeDefined();
      expect(kickedPlayer.connected).toBe(false);
    });

    it('should reject kick when player not found', () => {
      socket.roomCode = roomCode;
      socket.id = 'host-socket';

      io.connectionHandler(socket);
      const kickHandler = socket.on.mock.calls.find(
        call => call[0] === 'kickPlayer'
      )[1];

      kickHandler({ targetSocketId: 'nonexistent' });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Player not found',
        })
      );
    });
  });

  describe('leaveGame', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
    });

    it('should remove player from lobby when they leave', () => {
      socket.roomCode = roomCode;
      socket.id = 'socket-1';

      io.connectionHandler(socket);
      const leaveHandler = socket.on.mock.calls.find(
        call => call[0] === 'leaveGame'
      )[1];

      leaveHandler();

      const state = gameState.getGameState(roomCode);
      expect(state.players.find(p => p.socketId === 'socket-1')).toBeUndefined();
      expect(socket.leave).toHaveBeenCalledWith(roomCode);
      expect(socket.roomCode).toBeNull();
    });

    it('should cancel game when host leaves lobby', () => {
      socket.roomCode = roomCode;
      socket.id = 'host-socket';

      io.connectionHandler(socket);
      const leaveHandler = socket.on.mock.calls.find(
        call => call[0] === 'leaveGame'
      )[1];

      leaveHandler();

      const state = gameState.getGameState(roomCode);
      expect(state).toBeUndefined();
      expect(io.roomEmit).toHaveBeenCalledWith('gameCancelled', { reason: 'Host left the lobby' });
    });

    it('should mark player as disconnected when leaving active game', () => {
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
      gameState.startGame(roomCode);

      socket.roomCode = roomCode;
      socket.id = 'socket-1';

      io.connectionHandler(socket);
      const leaveHandler = socket.on.mock.calls.find(
        call => call[0] === 'leaveGame'
      )[1];

      leaveHandler();

      const state = gameState.getGameState(roomCode);
      const player = state.players.find(p => p.socketId === 'socket-1');
      expect(player.connected).toBe(false);
      expect(io.roomEmit).toHaveBeenCalledWith('playerDisconnected', { socketId: 'socket-1', name: 'Alice' });
    });
  });

  describe('getLobbyState', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
    });

    it('should return lobby state', () => {
      socket.roomCode = roomCode;

      io.connectionHandler(socket);
      const getLobbyHandler = socket.on.mock.calls.find(
        call => call[0] === 'getLobbyState'
      )[1];

      getLobbyHandler();

      expect(socket.emit).toHaveBeenCalledWith('lobbyUpdate', expect.objectContaining({
        roomCode,
        status: 'lobby',
      }));
    });

    it('should reject when not in a room', () => {
      io.connectionHandler(socket);
      const getLobbyHandler = socket.on.mock.calls.find(
        call => call[0] === 'getLobbyState'
      )[1];

      getLobbyHandler();

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });

  describe('checkRoomStatus', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
    });

    it('should return room status for valid room', () => {
      io.connectionHandler(socket);
      const checkHandler = socket.on.mock.calls.find(
        call => call[0] === 'checkRoomStatus'
      )[1];

      checkHandler({ roomCode: 'test' });

      expect(socket.emit).toHaveBeenCalledWith('roomStatus', expect.objectContaining({
        found: true,
        roomCode: 'test',
        status: 'lobby',
        canJoinAsNew: true,
      }));
    });

    it('should return not found for invalid room code', () => {
      io.connectionHandler(socket);
      const checkHandler = socket.on.mock.calls.find(
        call => call[0] === 'checkRoomStatus'
      )[1];

      checkHandler({ roomCode: '' });

      expect(socket.emit).toHaveBeenCalledWith('roomStatus', expect.objectContaining({
        found: false,
        error: 'Invalid room code format',
      }));
    });

    it('should return not found for nonexistent room', () => {
      io.connectionHandler(socket);
      const checkHandler = socket.on.mock.calls.find(
        call => call[0] === 'checkRoomStatus'
      )[1];

      checkHandler({ roomCode: 'nonexistent' });

      expect(socket.emit).toHaveBeenCalledWith('roomStatus', expect.objectContaining({
        found: false,
        error: 'Room not found',
      }));
    });

    it('should include disconnected players for in-progress game', () => {
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
      gameState.startGame(roomCode);
      gameState.disconnectPlayer(roomCode, 'socket-1');

      io.connectionHandler(socket);
      const checkHandler = socket.on.mock.calls.find(
        call => call[0] === 'checkRoomStatus'
      )[1];

      checkHandler({ roomCode: 'test' });

      expect(socket.emit).toHaveBeenCalledWith('roomStatus', expect.objectContaining({
        found: true,
        inProgress: true,
        disconnectedPlayers: expect.arrayContaining([
          expect.objectContaining({ name: 'Alice' })
        ]),
      }));
    });
  });

  describe('revealAnswer', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
      gameState.startGame(roomCode);
      gameState.startRound(roomCode, 'Test question', 'open_ended', null);
      gameState.submitAnswer(roomCode, 'socket-1', 'Blue', 2000);
    });

    it('should reveal an answer', () => {
      socket.roomCode = roomCode;

      io.connectionHandler(socket);
      const revealHandler = socket.on.mock.calls.find(
        call => call[0] === 'revealAnswer'
      )[1];

      revealHandler({ playerName: 'Alice' });

      expect(io.roomEmit).toHaveBeenCalledWith('answerRevealed', expect.objectContaining({
        playerName: 'Alice',
        answer: 'Blue',
        responseTime: 2000,
      }));
    });

    it('should reject when not in a room', () => {
      io.connectionHandler(socket);
      const revealHandler = socket.on.mock.calls.find(
        call => call[0] === 'revealAnswer'
      )[1];

      revealHandler({ playerName: 'Alice' });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });

  describe('awardPoint', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
    });

    it('should award point to team', () => {
      socket.roomCode = roomCode;

      const state = gameState.getGameState(roomCode);
      const teamId = state.teams[0].teamId;

      io.connectionHandler(socket);
      const awardHandler = socket.on.mock.calls.find(
        call => call[0] === 'awardPoint'
      )[1];

      awardHandler({ teamId });

      const updatedState = gameState.getGameState(roomCode);
      expect(updatedState.teams[0].score).toBe(1);
      expect(io.roomEmit).toHaveBeenCalledWith('scoreUpdated', { teamId, newScore: 1, pointsAwarded: 1 });
    });

    it('should award 2 points to team when specified', () => {
      socket.roomCode = roomCode;

      const state = gameState.getGameState(roomCode);
      const teamId = state.teams[0].teamId;

      io.connectionHandler(socket);
      const awardHandler = socket.on.mock.calls.find(
        call => call[0] === 'awardPoint'
      )[1];

      awardHandler({ teamId, points: 2 });

      const updatedState = gameState.getGameState(roomCode);
      expect(updatedState.teams[0].score).toBe(2);
      expect(io.roomEmit).toHaveBeenCalledWith('scoreUpdated', { teamId, newScore: 2, pointsAwarded: 2 });
    });

    it('should reject when not in a room', () => {
      io.connectionHandler(socket);
      const awardHandler = socket.on.mock.calls.find(
        call => call[0] === 'awardPoint'
      )[1];

      awardHandler({ teamId: 'team1' });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });

  describe('removePoint', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
    });

    it('should remove point from team', () => {
      socket.roomCode = roomCode;

      const state = gameState.getGameState(roomCode);
      const teamId = state.teams[0].teamId;

      // First award a point
      gameState.updateTeamScore(roomCode, teamId, 1);

      io.connectionHandler(socket);
      const removeHandler = socket.on.mock.calls.find(
        call => call[0] === 'removePoint'
      )[1];

      removeHandler({ teamId });

      const updatedState = gameState.getGameState(roomCode);
      expect(updatedState.teams[0].score).toBe(0);
      expect(io.roomEmit).toHaveBeenCalledWith('scoreUpdated', { teamId, newScore: 0, pointsAwarded: -1 });
    });

    it('should remove 2 points from team when specified', () => {
      socket.roomCode = roomCode;

      const state = gameState.getGameState(roomCode);
      const teamId = state.teams[0].teamId;

      // First award 2 points
      gameState.updateTeamScore(roomCode, teamId, 2);

      io.connectionHandler(socket);
      const removeHandler = socket.on.mock.calls.find(
        call => call[0] === 'removePoint'
      )[1];

      removeHandler({ teamId, points: 2 });

      const updatedState = gameState.getGameState(roomCode);
      expect(updatedState.teams[0].score).toBe(0);
      expect(io.roomEmit).toHaveBeenCalledWith('scoreUpdated', { teamId, newScore: 0, pointsAwarded: -2 });
    });

    it('should reject when not in a room', () => {
      io.connectionHandler(socket);
      const removeHandler = socket.on.mock.calls.find(
        call => call[0] === 'removePoint'
      )[1];

      removeHandler({ teamId: 'team1' });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });

  describe('nextRound', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
      gameState.startGame(roomCode);
      gameState.startRound(roomCode, 'Question 1', 'open_ended', null);
      gameState.submitAnswer(roomCode, 'socket-1', 'Answer1', 1000);
      gameState.submitAnswer(roomCode, 'socket-2', 'Answer2', 1000);
      gameState.completeRound(roomCode);
    });

    it('should move to next round', () => {
      socket.roomCode = roomCode;

      io.connectionHandler(socket);
      const nextRoundHandler = socket.on.mock.calls.find(
        call => call[0] === 'nextRound'
      )[1];

      nextRoundHandler();

      const state = gameState.getGameState(roomCode);
      expect(state.status).toBe('playing');
      expect(io.roomEmit).toHaveBeenCalledWith('readyForNextRound', expect.any(Object));
    });

    it('should reject when not in a room', () => {
      io.connectionHandler(socket);
      const nextRoundHandler = socket.on.mock.calls.find(
        call => call[0] === 'nextRound'
      )[1];

      nextRoundHandler();

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });

  describe('backToAnswering', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
      gameState.startGame(roomCode);
      gameState.startRound(roomCode, 'Question 1', 'open_ended', null);
      gameState.submitAnswer(roomCode, 'socket-1', 'Answer1', 1000);
      gameState.submitAnswer(roomCode, 'socket-2', 'Answer2', 1000);
      gameState.completeRound(roomCode);
    });

    it('should return to answering phase', () => {
      socket.roomCode = roomCode;

      io.connectionHandler(socket);
      const backHandler = socket.on.mock.calls.find(
        call => call[0] === 'backToAnswering'
      )[1];

      backHandler();

      const state = gameState.getGameState(roomCode);
      expect(state.status).toBe('playing');
      expect(io.roomEmit).toHaveBeenCalledWith('returnedToAnswering', expect.any(Object));
    });

    it('should reject when not in a room', () => {
      io.connectionHandler(socket);
      const backHandler = socket.on.mock.calls.find(
        call => call[0] === 'backToAnswering'
      )[1];

      backHandler();

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });

  describe('endGame', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
      gameState.addPlayer(roomCode, 'socket-2', 'Bob', false);
      gameState.pairPlayers(roomCode, 'socket-1', 'socket-2');
      gameState.startGame(roomCode);
    });

    it('should end the game', () => {
      socket.roomCode = roomCode;

      io.connectionHandler(socket);
      const endGameHandler = socket.on.mock.calls.find(
        call => call[0] === 'endGame'
      )[1];

      endGameHandler();

      const state = gameState.getGameState(roomCode);
      expect(state.status).toBe('ended');
      expect(io.roomEmit).toHaveBeenCalledWith('gameEnded', expect.any(Object));
    });

    it('should reject when not in a room', () => {
      io.connectionHandler(socket);
      const endGameHandler = socket.on.mock.calls.find(
        call => call[0] === 'endGame'
      )[1];

      endGameHandler();

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });

  describe('randomizeAvatar', () => {
    beforeEach(() => {
      gameState.initializeGame(roomCode);
      gameState.addPlayer(roomCode, 'socket-1', 'Alice', false);
    });

    it('should randomize player avatar and broadcast update', () => {
      socket.roomCode = roomCode;
      socket.id = 'socket-1';

      const stateBefore = gameState.getGameState(roomCode);
      const aliceBefore = stateBefore.players.find(p => p.name === 'Alice');
      const originalAvatar = { ...aliceBefore.avatar };

      io.connectionHandler(socket);
      const randomizeHandler = socket.on.mock.calls.find(
        call => call[0] === 'randomizeAvatar'
      )[1];

      // Randomize multiple times to ensure change (due to randomness)
      for (let i = 0; i < 10; i++) {
        randomizeHandler();
      }

      expect(io.to).toHaveBeenCalledWith(roomCode);
      expect(io.roomEmit).toHaveBeenCalledWith('lobbyUpdate', expect.any(Object));
    });

    it('should reject when not in a room', () => {
      io.connectionHandler(socket);
      const randomizeHandler = socket.on.mock.calls.find(
        call => call[0] === 'randomizeAvatar'
      )[1];

      randomizeHandler();

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Not in a room',
        })
      );
    });
  });
});
