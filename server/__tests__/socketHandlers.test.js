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
      roomCode: null,
      on: jest.fn(),
    };

    // Mock io
    io = {
      on: jest.fn((event, handler) => {
        // Store the connection handler
        if (event === 'connection') {
          io.connectionHandler = handler;
        }
      }),
      to: jest.fn(() => ({
        emit: jest.fn(),
      })),
    };

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

    it('should mark player as disconnected', () => {
      socket.roomCode = roomCode;
      socket.id = 'socket-1';

      io.connectionHandler(socket);
      const disconnectHandler = socket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )[1];

      disconnectHandler();

      const state = gameState.getGameState(roomCode);
      const player = state.players.find(p => p.socketId === 'socket-1');
      expect(player.connected).toBe(false);
    });
  });
});
