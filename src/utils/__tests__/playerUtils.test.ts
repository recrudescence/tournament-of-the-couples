import { describe, it, expect } from 'vitest';
import { findPlayerBySocketId, findPlayerByName } from '../playerUtils';
import type { Player } from '../../types/game';

const mockAvatar = { color: '#ff0000', emoji: '😀' };

describe('playerUtils', () => {
  const mockPlayers: Player[] = [
    {
      socketId: 'socket1',
      name: 'Alice',
      connected: true,
      partnerId: 'socket2',
      teamId: 'team1',
      avatar: mockAvatar,
    },
    {
      socketId: 'socket2',
      name: 'Bob',
      connected: true,
      partnerId: 'socket1',
      teamId: 'team1',
      avatar: mockAvatar,
    },
    {
      socketId: 'socket3',
      name: 'Charlie',
      connected: false,
      partnerId: null,
      teamId: null,
      avatar: mockAvatar,
    },
    {
      socketId: 'socket4',
      name: 'Diana',
      connected: true,
      partnerId: null,
      teamId: null,
      avatar: mockAvatar,
    },
  ];

  describe('findPlayerBySocketId', () => {
    it('finds a player by their socket ID', () => {
      const result = findPlayerBySocketId(mockPlayers, 'socket1');

      expect(result).toBeDefined();
      expect(result?.name).toBe('Alice');
      expect(result?.socketId).toBe('socket1');
    });

    it('finds a player with null partnerId', () => {
      const result = findPlayerBySocketId(mockPlayers, 'socket3');

      expect(result).toBeDefined();
      expect(result?.name).toBe('Charlie');
      expect(result?.partnerId).toBeNull();
    });

    it('finds a disconnected player', () => {
      const result = findPlayerBySocketId(mockPlayers, 'socket3');

      expect(result).toBeDefined();
      expect(result?.connected).toBe(false);
    });

    it('returns undefined when player is not found', () => {
      const result = findPlayerBySocketId(mockPlayers, 'nonexistent');

      expect(result).toBeUndefined();
    });

    it('returns undefined for empty players array', () => {
      const result = findPlayerBySocketId([], 'socket1');

      expect(result).toBeUndefined();
    });

    it('handles empty string socket ID', () => {
      const result = findPlayerBySocketId(mockPlayers, '');

      expect(result).toBeUndefined();
    });

    it('is case-sensitive for socket IDs', () => {
      const result = findPlayerBySocketId(mockPlayers, 'SOCKET1');

      expect(result).toBeUndefined();
    });

    it('finds the first matching player when duplicates exist', () => {
      const playersWithDuplicates: Player[] = [
        ...mockPlayers,
        {
          socketId: 'socket1', // Duplicate socket ID (should not happen in practice)
          name: 'Alice Clone',
          connected: true,
          partnerId: null,
          teamId: null,
          avatar: mockAvatar,
        },
      ];

      const result = findPlayerBySocketId(playersWithDuplicates, 'socket1');

      expect(result?.name).toBe('Alice'); // First match
    });
  });

  describe('findPlayerByName', () => {
    it('finds a player by their name', () => {
      const result = findPlayerByName(mockPlayers, 'Alice');

      expect(result).toBeDefined();
      expect(result?.name).toBe('Alice');
      expect(result?.socketId).toBe('socket1');
    });

    it('finds a player with different states', () => {
      const result = findPlayerByName(mockPlayers, 'Charlie');

      expect(result).toBeDefined();
      expect(result?.connected).toBe(false);
      expect(result?.partnerId).toBeNull();
    });

    it('returns undefined when player is not found', () => {
      const result = findPlayerByName(mockPlayers, 'Eve');

      expect(result).toBeUndefined();
    });

    it('returns undefined for empty players array', () => {
      const result = findPlayerByName([], 'Alice');

      expect(result).toBeUndefined();
    });

    it('handles empty string name', () => {
      const result = findPlayerByName(mockPlayers, '');

      expect(result).toBeUndefined();
    });

    it('is case-sensitive for names', () => {
      const result = findPlayerByName(mockPlayers, 'alice');

      expect(result).toBeUndefined();
    });

    it('handles names with special characters', () => {
      const specialPlayers: Player[] = [
        {
          socketId: 'socket5',
          name: "O'Brien",
          connected: true,
          partnerId: null,
          teamId: null,
          avatar: mockAvatar,
        },
        {
          socketId: 'socket6',
          name: 'José García',
          connected: true,
          partnerId: null,
          teamId: null,
          avatar: mockAvatar,
        },
      ];

      const result1 = findPlayerByName(specialPlayers, "O'Brien");
      const result2 = findPlayerByName(specialPlayers, 'José García');

      expect(result1?.socketId).toBe('socket5');
      expect(result2?.socketId).toBe('socket6');
    });

    it('handles names with whitespace', () => {
      const whitespacePlayers: Player[] = [
        {
          socketId: 'socket7',
          name: 'John Doe',
          connected: true,
          partnerId: null,
          teamId: null,
          avatar: mockAvatar,
        },
        {
          socketId: 'socket8',
          name: '  Spaces  ', // Name with extra spaces
          connected: true,
          partnerId: null,
          teamId: null,
          avatar: mockAvatar,
        },
      ];

      const result1 = findPlayerByName(whitespacePlayers, 'John Doe');
      const result2 = findPlayerByName(whitespacePlayers, '  Spaces  ');

      expect(result1?.socketId).toBe('socket7');
      expect(result2?.socketId).toBe('socket8');

      // Different spacing should NOT match
      expect(findPlayerByName(whitespacePlayers, 'JohnDoe')).toBeUndefined();
    });

    it('finds the first matching player when duplicate names exist', () => {
      const playersWithDuplicates: Player[] = [
        ...mockPlayers,
        {
          socketId: 'socket5',
          name: 'Alice', // Duplicate name (possible in the game)
          connected: true,
          partnerId: null,
          teamId: null,
          avatar: mockAvatar,
        },
      ];

      const result = findPlayerByName(playersWithDuplicates, 'Alice');

      expect(result?.socketId).toBe('socket1'); // First match
    });
  });

  describe('edge cases and integration', () => {
    it('both functions work with the same player', () => {
      const bySocketId = findPlayerBySocketId(mockPlayers, 'socket2');
      const byName = findPlayerByName(mockPlayers, 'Bob');

      expect(bySocketId).toEqual(byName);
      expect(bySocketId?.name).toBe('Bob');
      expect(byName?.socketId).toBe('socket2');
    });

    it('handles large arrays efficiently', () => {
      const largePlayers: Player[] = Array.from({ length: 1000 }, (_, i) => ({
        socketId: `socket${i}`,
        name: `Player${i}`,
        connected: true,
        partnerId: null,
        teamId: null,
        avatar: mockAvatar,
      }));

      const result1 = findPlayerBySocketId(largePlayers, 'socket999');
      const result2 = findPlayerByName(largePlayers, 'Player999');

      expect(result1?.name).toBe('Player999');
      expect(result2?.socketId).toBe('socket999');
    });

    it('returns undefined when searching in array with only partial matches', () => {
      const result1 = findPlayerByName(mockPlayers, 'Ali'); // Partial match
      const result2 = findPlayerBySocketId(mockPlayers, 'socket'); // Partial match

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });
  });
});
