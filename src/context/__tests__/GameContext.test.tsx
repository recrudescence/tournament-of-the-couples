import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GameProvider, useGameContext } from '../GameContext';
import type { GameState, Player, Team } from '../../types/game';
import { GameStatus, RoundPhase } from '../../types/game';

const mockAvatar = { color: '#ff0000', emoji: '😀' };

// Wrapper component for testing
function wrapper({ children }: { children: React.ReactNode }) {
  return <GameProvider>{children}</GameProvider>;
}

describe('GameContext', () => {
  const mockPlayer1: Player = {
    socketId: 'socket1',
    name: 'Alice',
    connected: true,
    partnerId: 'socket2',
    teamId: 'team1',
    avatar: mockAvatar
  };

  const mockPlayer2: Player = {
    socketId: 'socket2',
    name: 'Bob',
    connected: true,
    partnerId: 'socket1',
    teamId: 'team1',
    avatar: mockAvatar
  };

  const mockTeam: Team = {
    teamId: 'team1',
    player1Id: 'socket1',
    player2Id: 'socket2',
    score: 5
  };

  const mockGameState: GameState = {
    roomCode: 'test',
    gameId: 'game1',
    host: { socketId: 'host1', name: 'Host', avatar: mockAvatar },
    players: [mockPlayer1, mockPlayer2],
    teams: [mockTeam],
    status: GameStatus.LOBBY,
    currentRound: null,
    teamTotalResponseTimes: {}
  };

  describe('Initial State', () => {
    it('initializes with null gameState and playerInfo', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      expect(result.current.gameState).toBeNull();
      expect(result.current.playerInfo).toBeNull();
      expect(result.current.roundPhase).toBe('initial');
    });

    it('initializes computed values as null', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      expect(result.current.myPlayer).toBeNull();
      expect(result.current.myTeam).toBeNull();
      expect(result.current.myPartner).toBeNull();
    });
  });

  describe('SET_GAME_STATE', () => {
    it('updates gameState', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_GAME_STATE', payload: mockGameState });
      });

      expect(result.current.gameState).toEqual(mockGameState);
    });

    it('updates computed values when playerInfo is set', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_PLAYER_INFO', payload: { name: 'Alice', isHost: false, roomCode: 'test' } });
        result.current.dispatch({ type: 'SET_GAME_STATE', payload: mockGameState });
      });

      expect(result.current.myPlayer).toEqual(mockPlayer1);
      expect(result.current.myTeam).toEqual(mockTeam);
      expect(result.current.myPartner).toEqual(mockPlayer2);
    });
  });

  describe('SET_PLAYER_INFO', () => {
    it('updates playerInfo', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      const playerInfo = { name: 'Alice', isHost: false, roomCode: 'test' };
      act(() => {
        result.current.dispatch({ type: 'SET_PLAYER_INFO', payload: playerInfo });
      });

      expect(result.current.playerInfo).toEqual(playerInfo);
    });

    it('sets playerInfo to null when payload is null', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_PLAYER_INFO', payload: { name: 'Alice', isHost: false, roomCode: 'test' } });
        result.current.dispatch({ type: 'SET_PLAYER_INFO', payload: null });
      });

      expect(result.current.playerInfo).toBeNull();
    });
  });

  describe('SET_ROUND_PHASE', () => {
    it('updates roundPhase', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_ROUND_PHASE', payload: RoundPhase.IN_PROGRESS });
      });

      expect(result.current.roundPhase).toBe(RoundPhase.IN_PROGRESS);
    });
  });

  describe('UPDATE_PLAYERS', () => {
    it('updates players array when gameState exists', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_GAME_STATE', payload: mockGameState });

        const newPlayers = [
          { ...mockPlayer1, connected: false },
          mockPlayer2
        ];

        result.current.dispatch({ type: 'UPDATE_PLAYERS', payload: newPlayers });
      });

      expect(result.current.gameState?.players[0]?.connected).toBe(false);
    });

    it('does nothing when gameState is null', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'UPDATE_PLAYERS', payload: [mockPlayer1] });
      });

      expect(result.current.gameState).toBeNull();
    });
  });

  describe('UPDATE_TEAMS', () => {
    it('updates teams array when gameState exists', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_GAME_STATE', payload: mockGameState });

        const newTeam = { ...mockTeam, score: 10 };
        result.current.dispatch({ type: 'UPDATE_TEAMS', payload: [newTeam] });
      });

      expect(result.current.gameState?.teams[0]?.score).toBe(10);
    });

    it('does nothing when gameState is null', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'UPDATE_TEAMS', payload: [mockTeam] });
      });

      expect(result.current.gameState).toBeNull();
    });
  });

  describe('UPDATE_TEAM_SCORE', () => {
    it('updates specific team score when gameState exists', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_GAME_STATE', payload: mockGameState });
        result.current.dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId: 'team1', newScore: 15 } });
      });

      expect(result.current.gameState?.teams[0]?.score).toBe(15);
    });

    it('only updates the specified team', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      const multiTeamState = {
        ...mockGameState,
        teams: [
          mockTeam,
          { teamId: 'team2', player1Id: 'socket3', player2Id: 'socket4', score: 3 }
        ]
      };

      act(() => {
        result.current.dispatch({ type: 'SET_GAME_STATE', payload: multiTeamState });
        result.current.dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId: 'team1', newScore: 20 } });
      });

      expect(result.current.gameState?.teams[0]?.score).toBe(20);
      expect(result.current.gameState?.teams[1]?.score).toBe(3);
    });

    it('does nothing when gameState is null', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId: 'team1', newScore: 10 } });
      });

      expect(result.current.gameState).toBeNull();
    });
  });

  describe('RESET', () => {
    it('resets all state to initial values', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_GAME_STATE', payload: mockGameState });
        result.current.dispatch({ type: 'SET_PLAYER_INFO', payload: { name: 'Alice', isHost: false, roomCode: 'test' } });
        result.current.dispatch({ type: 'SET_ROUND_PHASE', payload: RoundPhase.IN_PROGRESS });

        result.current.dispatch({ type: 'RESET' });
      });

      expect(result.current.gameState).toBeNull();
      expect(result.current.playerInfo).toBeNull();
      expect(result.current.roundPhase).toBe('initial');
    });
  });

  describe('Computed Values', () => {
    it('finds myPlayer by matching playerInfo.name', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_PLAYER_INFO', payload: { name: 'Bob', isHost: false, roomCode: 'test' } });
        result.current.dispatch({ type: 'SET_GAME_STATE', payload: mockGameState });
      });

      expect(result.current.myPlayer).toEqual(mockPlayer2);
    });

    it('finds myTeam using myPlayer.teamId', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_PLAYER_INFO', payload: { name: 'Alice', isHost: false, roomCode: 'test' } });
        result.current.dispatch({ type: 'SET_GAME_STATE', payload: mockGameState });
      });

      expect(result.current.myTeam).toEqual(mockTeam);
    });

    it('finds myPartner using myPlayer.partnerId', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      act(() => {
        result.current.dispatch({ type: 'SET_PLAYER_INFO', payload: { name: 'Alice', isHost: false, roomCode: 'test' } });
        result.current.dispatch({ type: 'SET_GAME_STATE', payload: mockGameState });
      });

      expect(result.current.myPartner).toEqual(mockPlayer2);
    });

    it('returns null for myTeam when player has no teamId', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      const unpairedState = {
        ...mockGameState,
        players: [{ ...mockPlayer1, teamId: null, partnerId: null }]
      };

      act(() => {
        result.current.dispatch({ type: 'SET_PLAYER_INFO', payload: { name: 'Alice', isHost: false, roomCode: 'test' } });
        result.current.dispatch({ type: 'SET_GAME_STATE', payload: unpairedState });
      });

      expect(result.current.myTeam).toBeNull();
    });

    it('returns null for myPartner when player has no partnerId', () => {
      const { result } = renderHook(() => useGameContext(), { wrapper });

      const unpairedState = {
        ...mockGameState,
        players: [{ ...mockPlayer1, teamId: null, partnerId: null }]
      };

      act(() => {
        result.current.dispatch({ type: 'SET_PLAYER_INFO', payload: { name: 'Alice', isHost: false, roomCode: 'test' } });
        result.current.dispatch({ type: 'SET_GAME_STATE', payload: unpairedState });
      });

      expect(result.current.myPartner).toBeNull();
    });
  });
});
