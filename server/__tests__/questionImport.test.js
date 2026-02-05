// Mock roomCodeGenerator before requiring gameState
jest.mock('../roomCodeGenerator', () => ({
  generateRoomCode: jest.fn(() => 'test-import'),
  generateTeamCode: jest.fn(() => 'team' + Math.random().toString(36).substr(2, 4)),
  validateRoomCode: jest.fn(() => true),
  markRoomInactive: jest.fn(),
  isRoomActive: jest.fn(() => true)
}));

const gameState = require('../gameState');

describe('GameState - Question Import', () => {
  let roomCode;

  beforeEach(() => {
    roomCode = 'test-import';
    gameState.initializeGame(roomCode);
    gameState.addPlayer(roomCode, 'host-socket', 'Host', true);
    gameState.addPlayer(roomCode, 'player1', 'Alice', false);
    gameState.addPlayer(roomCode, 'player2', 'Bob', false);
    gameState.pairPlayers(roomCode, 'player1', 'player2');
  });

  afterEach(() => {
    if (gameState.hasRoom(roomCode)) {
      gameState.deleteRoom(roomCode);
    }
  });

  describe('setImportedQuestions', () => {
    it('stores imported questions', () => {
      const questionSet = {
        title: 'Test Questions',
        chapters: [{ title: 'Ch1', questions: [{ question: 'Q1', variant: 'open_ended' }] }]
      };
      gameState.setImportedQuestions(roomCode, questionSet);
      const state = gameState.getGameState(roomCode);
      expect(state.importedQuestions).toEqual(questionSet);
      expect(state.questionCursor).toBeNull();
    });

    it('throws error for non-existent room', () => {
      expect(() => {
        gameState.setImportedQuestions('nonexistent', {});
      }).toThrow('Game not initialized');
    });
  });

  describe('clearImportedQuestions', () => {
    it('clears imported questions and cursor', () => {
      const questionSet = { title: 'Test', chapters: [{ title: 'Ch', questions: [{ question: 'Q' }] }] };
      gameState.setImportedQuestions(roomCode, questionSet);
      gameState.clearImportedQuestions(roomCode);
      const state = gameState.getGameState(roomCode);
      expect(state.importedQuestions).toBeNull();
      expect(state.questionCursor).toBeNull();
    });
  });

  describe('advanceCursor', () => {
    const multiChapterSet = {
      title: 'Test',
      chapters: [
        { title: 'Ch1', questions: [{ question: 'Q1', variant: 'open_ended' }, { question: 'Q2', variant: 'binary' }] },
        { title: 'Ch2', questions: [{ question: 'Q3', variant: 'multiple_choice' }] }
      ]
    };

    beforeEach(() => {
      gameState.setImportedQuestions(roomCode, multiChapterSet);
    });

    it('advances to first question on first call', () => {
      const result = gameState.advanceCursor(roomCode);
      expect(result.chapterIndex).toBe(0);
      expect(result.questionIndex).toBe(0);
      expect(result.question.question).toBe('Q1');
      expect(result.isNewChapter).toBe(true);
    });

    it('advances within same chapter', () => {
      gameState.advanceCursor(roomCode); // Q1
      const result = gameState.advanceCursor(roomCode); // Q2
      expect(result.chapterIndex).toBe(0);
      expect(result.questionIndex).toBe(1);
      expect(result.isNewChapter).toBe(false);
    });

    it('advances to new chapter', () => {
      gameState.advanceCursor(roomCode); // Q1
      gameState.advanceCursor(roomCode); // Q2
      const result = gameState.advanceCursor(roomCode); // Q3
      expect(result.chapterIndex).toBe(1);
      expect(result.questionIndex).toBe(0);
      expect(result.isNewChapter).toBe(true);
    });

    it('returns null when exhausted', () => {
      gameState.advanceCursor(roomCode); // Q1
      gameState.advanceCursor(roomCode); // Q2
      gameState.advanceCursor(roomCode); // Q3
      const result = gameState.advanceCursor(roomCode); // exhausted
      expect(result).toBeNull();
    });

    it('tracks isLastQuestion correctly', () => {
      gameState.advanceCursor(roomCode); // Q1 - not last
      gameState.advanceCursor(roomCode); // Q2 - not last
      const result = gameState.advanceCursor(roomCode); // Q3 - last
      expect(result.isLastQuestion).toBe(true);
    });

    it('throws error without imported questions', () => {
      gameState.clearImportedQuestions(roomCode);
      expect(() => {
        gameState.advanceCursor(roomCode);
      }).toThrow('No imported questions');
    });
  });

  describe('getCurrentQuestion', () => {
    const questionSet = {
      title: 'Test',
      chapters: [{ title: 'Ch1', questions: [{ question: 'Q1', variant: 'open_ended' }] }]
    };

    it('returns null before cursor is set', () => {
      gameState.setImportedQuestions(roomCode, questionSet);
      expect(gameState.getCurrentQuestion(roomCode)).toBeNull();
    });

    it('returns current question after advance', () => {
      gameState.setImportedQuestions(roomCode, questionSet);
      gameState.advanceCursor(roomCode);
      const result = gameState.getCurrentQuestion(roomCode);
      expect(result.question.question).toBe('Q1');
      expect(result.chapter.title).toBe('Ch1');
    });
  });

  describe('resetGame clears imports', () => {
    it('clears imported questions on reset', () => {
      const questionSet = { title: 'Test', chapters: [{ title: 'Ch', questions: [{ question: 'Q' }] }] };
      gameState.setImportedQuestions(roomCode, questionSet);
      gameState.startGame(roomCode);
      gameState.resetGame(roomCode);
      const state = gameState.getGameState(roomCode);
      expect(state.importedQuestions).toBeNull();
      expect(state.questionCursor).toBeNull();
    });
  });

  describe('initializeGame has import fields', () => {
    it('initializes with null import fields', () => {
      const newRoom = 'new-test-room';
      const state = gameState.initializeGame(newRoom);
      expect(state.importedQuestions).toBeNull();
      expect(state.questionCursor).toBeNull();
      gameState.deleteRoom(newRoom);
    });
  });
});
