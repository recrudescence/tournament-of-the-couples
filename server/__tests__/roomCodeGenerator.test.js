// Mock random-words module
jest.mock('random-words', () => {
  let callCount = 0;
  const words = ['test', 'game', 'play', 'room', 'code', 'word'];

  return {
    generate: jest.fn(() => {
      const word = words[callCount % words.length];
      callCount++;
      return [word];
    })
  };
});

const { generateRoomCode, generateTeamCode, validateRoomCode, markRoomInactive, isRoomActive } = require('../roomCodeGenerator');
const randomWords = require('random-words');

describe('Room Code Generator', () => {
  beforeEach(() => {
    // Clear the active rooms set by requiring a fresh instance
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('generateRoomCode', () => {
    test('generates codes', () => {
      // Re-require to get fresh instance after reset
      const generator = require('../roomCodeGenerator');
      const code = generator.generateRoomCode();

      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(code.length).toBe(4);
      expect(/^[a-z]+$/.test(code)).toBe(true);
    });

    test('generates lowercase codes', () => {
      const generator = require('../roomCodeGenerator');
      const code = generator.generateRoomCode();

      expect(code).toBe(code.toLowerCase());
    });

    test('marks generated room as active', () => {
      const generator = require('../roomCodeGenerator');
      const code = generator.generateRoomCode();

      expect(generator.isRoomActive(code)).toBe(true);
    });

    test('generates unique codes when called multiple times', () => {
      const generator = require('../roomCodeGenerator');
      const codes = new Set();

      for (let i = 0; i < 5; i++) {
        codes.add(generator.generateRoomCode());
      }

      // All codes should be unique
      expect(codes.size).toBe(5);
    });
  });

  describe('generateTeamCode', () => {
    test('generates team codes', () => {
      const generator = require('../roomCodeGenerator');
      const code = generator.generateTeamCode();

      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(code.length).toBe(4);
      expect(/^[a-z]+$/.test(code)).toBe(true);
    });

    test('generates lowercase codes', () => {
      const generator = require('../roomCodeGenerator');
      const code = generator.generateTeamCode();

      expect(code).toBe(code.toLowerCase());
    });
  });

  describe('validateRoomCode', () => {
    test('validates correct lowercase codes', () => {
      const generator = require('../roomCodeGenerator');

      expect(generator.validateRoomCode('gamers')).toBe(true);
      expect(generator.validateRoomCode('tested')).toBe(true);
      expect(generator.validateRoomCode('roomed')).toBe(true);
    });

    test('rejects uppercase codes', () => {
      const generator = require('../roomCodeGenerator');

      expect(generator.validateRoomCode('GAMERS')).toBe(false);
      expect(generator.validateRoomCode('Gamers')).toBe(false);
    });

    test('rejects codes with wrong length', () => {
      const generator = require('../roomCodeGenerator');

      expect(generator.validateRoomCode('game')).toBe(false);     // too short (4 chars)
      expect(generator.validateRoomCode('gam')).toBe(false);      // too short (3 chars)
      expect(generator.validateRoomCode('gamers7')).toBe(false);  // too long (7 chars)
      expect(generator.validateRoomCode('ga')).toBe(false);       // too short (2 chars)
    });

    test('rejects codes with numbers', () => {
      const generator = require('../roomCodeGenerator');

      expect(generator.validateRoomCode('game12')).toBe(false);
      expect(generator.validateRoomCode('123456')).toBe(false);
    });

    test('rejects codes with special characters', () => {
      const generator = require('../roomCodeGenerator');

      expect(generator.validateRoomCode('game-r')).toBe(false);
      expect(generator.validateRoomCode('game!r')).toBe(false);
      expect(generator.validateRoomCode('gam er')).toBe(false);
    });

    test('rejects non-string values', () => {
      const generator = require('../roomCodeGenerator');

      expect(generator.validateRoomCode(null)).toBe(false);
      expect(generator.validateRoomCode(undefined)).toBe(false);
      expect(generator.validateRoomCode(1234)).toBe(false);
      expect(generator.validateRoomCode({})).toBe(false);
    });
  });

  describe('Room Activity Tracking', () => {
    test('isRoomActive returns false for non-existent rooms', () => {
      const generator = require('../roomCodeGenerator');

      expect(generator.isRoomActive('test')).toBe(false);
      expect(generator.isRoomActive('nonexistent')).toBe(false);
    });

    test('isRoomActive returns true for generated rooms', () => {
      const generator = require('../roomCodeGenerator');
      const code = generator.generateRoomCode();

      expect(generator.isRoomActive(code)).toBe(true);
    });

    test('markRoomInactive removes room from active list', () => {
      const generator = require('../roomCodeGenerator');
      const code = generator.generateRoomCode();

      expect(generator.isRoomActive(code)).toBe(true);

      generator.markRoomInactive(code);

      expect(generator.isRoomActive(code)).toBe(false);
    });

    test('markRoomInactive is safe to call on non-existent rooms', () => {
      const generator = require('../roomCodeGenerator');

      // Should not throw
      expect(() => {
        generator.markRoomInactive('nonexistent');
      }).not.toThrow();

      expect(generator.isRoomActive('nonexistent')).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('full lifecycle: generate, check active, deactivate, check inactive', () => {
      const generator = require('../roomCodeGenerator');

      // Generate room code
      const code = generator.generateRoomCode();
      expect(code).toBeDefined();

      // Should be active after generation
      expect(generator.isRoomActive(code)).toBe(true);

      // Deactivate
      generator.markRoomInactive(code);

      // Should no longer be active
      expect(generator.isRoomActive(code)).toBe(false);
    });

    test('multiple rooms can be active simultaneously', () => {
      const generator = require('../roomCodeGenerator');

      const code1 = generator.generateRoomCode();
      const code2 = generator.generateRoomCode();
      const code3 = generator.generateRoomCode();

      expect(generator.isRoomActive(code1)).toBe(true);
      expect(generator.isRoomActive(code2)).toBe(true);
      expect(generator.isRoomActive(code3)).toBe(true);

      // Deactivate one
      generator.markRoomInactive(code2);

      // Others should still be active
      expect(generator.isRoomActive(code1)).toBe(true);
      expect(generator.isRoomActive(code2)).toBe(false);
      expect(generator.isRoomActive(code3)).toBe(true);
    });
  });
});
