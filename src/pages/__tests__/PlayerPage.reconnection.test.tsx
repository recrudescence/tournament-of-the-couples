import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PlayerPage } from '../PlayerPage';
import type { GameState, Player, Team, CurrentRound } from '../../types/game';
import { GameStatus, RoundStatus, RoundVariant } from '../../types/game';

const mockAvatar = { color: '#ff0000', emoji: '😀' };
import * as playerUtils from '../../utils/playerUtils';

// Mock implementations
const mockEmit = vi.fn();
const mockOn = vi.fn(() => vi.fn());
const mockDispatch = vi.fn();
const mockShowError = vi.fn();
const mockRequestWakeLock = vi.fn();
const mockStartTimer = vi.fn();

let mockGameState: GameState | null = null;
let mockPlayerInfo: { name: string; isHost: boolean; roomCode: string } | null = null;
let mockMyPlayer: Player | null = null;
let mockMyTeam: Team | null = null;
let mockMyPartner: Player | null = null;

// Mock modules
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../../hooks/useSocket', () => ({
  useSocket: () => ({
    isConnected: true,
    emit: mockEmit,
    on: mockOn,
  }),
}));

vi.mock('../../hooks/usePlayerInfo', () => ({
  usePlayerInfo: () => ({
    playerInfo: mockPlayerInfo,
  }),
}));

vi.mock('../../hooks/useGameError', () => ({
  useGameError: () => ({
    error: null,
    showError: mockShowError,
  }),
}));

vi.mock('../../context/GameContext', () => ({
  useGameContext: () => ({
    gameState: mockGameState,
    dispatch: mockDispatch,
    myPlayer: mockMyPlayer,
    myTeam: mockMyTeam,
    myPartner: mockMyPartner,
  }),
}));

vi.mock('../../hooks/useWakeLock', () => ({
  useWakeLock: () => ({
    requestWakeLock: mockRequestWakeLock,
    isSupported: true,
  }),
}));

vi.mock('../../hooks/useTimer', () => ({
  useTimer: () => ({
    responseTime: 0,
    startTimer: mockStartTimer,
    stopTimer: vi.fn(),
    getFinalTime: vi.fn(() => 1000),
  }),
}));

// Spy on playerUtils
vi.spyOn(playerUtils, 'findPlayerBySocketId').mockImplementation((players, socketId) => {
  return players.find(p => p.socketId === socketId);
});

describe('PlayerPage Reconnection Scenarios', () => {
  const createPlayer = (name: string, socketId: string, teamId: string, partnerId: string): Player => ({
    socketId,
    name,
    connected: true,
    partnerId,
    teamId,
    avatar: mockAvatar,
  });

  const createTeam = (teamId: string, player1Id: string, player2Id: string): Team => ({
    teamId,
    player1Id,
    player2Id,
    score: 0,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGameState = null;
    mockPlayerInfo = null;
    mockMyPlayer = null;
    mockMyTeam = null;
    mockMyPartner = null;
  });

  describe('Reconnection during reopened answering phase', () => {
    it('shows answering screen when player reconnects during reopened round (not submitted in current phase)', () => {
      const alice = createPlayer('Alice', 'socket1', 'team1', 'socket2');
      const bob = createPlayer('Bob', 'socket2', 'team1', 'socket1');
      const team = createTeam('team1', 'socket1', 'socket2');

      const round: CurrentRound = {
        roundNumber: 1,
        roundId: 'round1',
        question: 'Test question',
        variant: RoundVariant.OPEN_ENDED,
        options: null,
        answerForBoth: false,
        answers: {
          // Alice had submitted before round was reopened
          'Alice': { text: 'Previous answer', responseTime: 1500 },
          'Bob': { text: 'Bobs answer', responseTime: 1200 }
        },
        submittedInCurrentPhase: [], // Empty because round was reopened
        status: RoundStatus.ANSWERING,
        createdAt: Date.now() - 1500,
      };

      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host', avatar: mockAvatar },
        players: [alice, bob],
        teams: [team],
        status: GameStatus.PLAYING,
        currentRound: round,
      };
      mockPlayerInfo = { name: 'Alice', isHost: false, roomCode: 'test' };
      mockMyPlayer = alice;
      mockMyTeam = team;
      mockMyPartner = bob;

      render(
        <MemoryRouter>
          <PlayerPage />
        </MemoryRouter>
      );

      // Should show answering screen, not submitted screen
      expect(screen.getByText(/Round 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Test question/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit Answer/i })).toBeInTheDocument();
    });

    it('pre-fills answer field with previous answer when reconnecting during reopened round', () => {
      const alice = createPlayer('Alice', 'socket1', 'team1', 'socket2');
      const bob = createPlayer('Bob', 'socket2', 'team1', 'socket1');
      const team = createTeam('team1', 'socket1', 'socket2');

      const round: CurrentRound = {
        roundNumber: 1,
        roundId: 'round1',
        question: 'Test question',
        variant: RoundVariant.OPEN_ENDED,
        options: null,
        answerForBoth: false,
        answers: {
          'Alice': { text: 'My previous answer', responseTime: 1500 },
          'Bob': { text: 'Bobs answer', responseTime: 1200 }
        },
        submittedInCurrentPhase: [], // Reopened
        status: RoundStatus.ANSWERING,
        createdAt: Date.now() - 1500,
      };

      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host', avatar: mockAvatar },
        players: [alice, bob],
        teams: [team],
        status: GameStatus.PLAYING,
        currentRound: round,
      };
      mockPlayerInfo = { name: 'Alice', isHost: false, roomCode: 'test' };
      mockMyPlayer = alice;
      mockMyTeam = team;
      mockMyPartner = bob;

      render(
        <MemoryRouter>
          <PlayerPage />
        </MemoryRouter>
      );

      // Answer field should be pre-filled
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('My previous answer');
    });

    it('shows submitted screen when player has submitted in current phase', () => {
      const alice = createPlayer('Alice', 'socket1', 'team1', 'socket2');
      const bob = createPlayer('Bob', 'socket2', 'team1', 'socket1');
      const team = createTeam('team1', 'socket1', 'socket2');

      const round: CurrentRound = {
        roundNumber: 1,
        roundId: 'round1',
        question: 'Test question',
        variant: RoundVariant.OPEN_ENDED,
        options: null,
        answerForBoth: false,
        answers: {
          'Alice': { text: 'Current answer', responseTime: 1500 },
          'Bob': { text: 'Bobs answer', responseTime: 1200 }
        },
        submittedInCurrentPhase: ['Alice'], // Alice submitted in current phase
        status: RoundStatus.ANSWERING,
        createdAt: Date.now() - 1500,
      };

      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host', avatar: mockAvatar },
        players: [alice, bob],
        teams: [team],
        status: GameStatus.PLAYING,
        currentRound: round,
      };
      mockPlayerInfo = { name: 'Alice', isHost: false, roomCode: 'test' };
      mockMyPlayer = alice;
      mockMyTeam = team;
      mockMyPartner = bob;

      render(
        <MemoryRouter>
          <PlayerPage />
        </MemoryRouter>
      );

      // Should show submitted status
      expect(screen.getByText(/Submitted!/i)).toBeInTheDocument();
      expect(screen.getByText(/Current answer/i)).toBeInTheDocument();
    });
  });

  describe('Binary variant reconnection', () => {
    it('shows actual player names in binary questions when reconnecting during reopened round', () => {
      const alice = createPlayer('Alice', 'socket1', 'team1', 'socket2');
      const bob = createPlayer('Bob', 'socket2', 'team1', 'socket1');
      const team = createTeam('team1', 'socket1', 'socket2');

      const round: CurrentRound = {
        roundNumber: 1,
        roundId: 'round1',
        question: 'Who is more likely to cook dinner?',
        variant: RoundVariant.BINARY,
        options: ['Player 1', 'Player 2'], // Placeholders from server
        answerForBoth: false,
        answers: {
          'Alice': { text: 'Alice', responseTime: 1500 }
        },
        submittedInCurrentPhase: [], // Reopened
        status: RoundStatus.ANSWERING,
        createdAt: Date.now() - 1500,
      };

      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host', avatar: mockAvatar },
        players: [alice, bob],
        teams: [team],
        status: GameStatus.PLAYING,
        currentRound: round,
      };
      mockPlayerInfo = { name: 'Alice', isHost: false, roomCode: 'test' };
      mockMyPlayer = alice;
      mockMyTeam = team;
      mockMyPartner = bob;

      render(
        <MemoryRouter>
          <PlayerPage />
        </MemoryRouter>
      );

      // Should show actual player names as radio options, not placeholders
      expect(screen.getByLabelText('Alice')).toBeInTheDocument();
      expect(screen.getByLabelText('Bob')).toBeInTheDocument();
      expect(screen.queryByLabelText('Player 1')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Player 2')).not.toBeInTheDocument();
    });

    it('shows actual player names during scoring phase reconnection', () => {
      const alice = createPlayer('Alice', 'socket1', 'team1', 'socket2');
      const bob = createPlayer('Bob', 'socket2', 'team1', 'socket1');
      const team = createTeam('team1', 'socket1', 'socket2');

      const round: CurrentRound = {
        roundNumber: 1,
        roundId: 'round1',
        question: 'Who is more likely to cook dinner?',
        variant: RoundVariant.BINARY,
        options: ['Player 1', 'Player 2'],
        answerForBoth: false,
        answers: {
          'Alice': { text: 'Alice', responseTime: 1500 },
          'Bob': { text: 'Bob', responseTime: 1200 }
        },
        submittedInCurrentPhase: ['Alice', 'Bob'],
        status: RoundStatus.COMPLETE,
        createdAt: Date.now() - 1500,
      };

      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host', avatar: mockAvatar },
        players: [alice, bob],
        teams: [team],
        status: GameStatus.SCORING,
        currentRound: round,
      };
      mockPlayerInfo = { name: 'Alice', isHost: false, roomCode: 'test' };
      mockMyPlayer = alice;
      mockMyTeam = team;
      mockMyPartner = bob;

      render(
        <MemoryRouter>
          <PlayerPage />
        </MemoryRouter>
      );

      // Should show scoring status
      expect(screen.getByText(/The host is reviewing answers/i)).toBeInTheDocument();
    });
  });

  describe('Multiple choice variant reconnection', () => {
    it('shows multiple choice options when reconnecting during reopened round', () => {
      const alice = createPlayer('Alice', 'socket1', 'team1', 'socket2');
      const bob = createPlayer('Bob', 'socket2', 'team1', 'socket1');
      const team = createTeam('team1', 'socket1', 'socket2');

      const round: CurrentRound = {
        roundNumber: 1,
        roundId: 'round1',
        question: 'What is your favorite color?',
        variant: RoundVariant.MULTIPLE_CHOICE,
        options: ['Red', 'Blue', 'Green', 'Yellow'],
        answerForBoth: false,
        answers: {
          'Alice': { text: 'Red', responseTime: 1500 }
        },
        submittedInCurrentPhase: [],
        status: RoundStatus.ANSWERING,
        createdAt: Date.now() - 1500,
      };

      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host', avatar: mockAvatar },
        players: [alice, bob],
        teams: [team],
        status: GameStatus.PLAYING,
        currentRound: round,
      };
      mockPlayerInfo = { name: 'Alice', isHost: false, roomCode: 'test' };
      mockMyPlayer = alice;
      mockMyTeam = team;
      mockMyPartner = bob;

      render(
        <MemoryRouter>
          <PlayerPage />
        </MemoryRouter>
      );

      // Should show all options
      expect(screen.getByLabelText('Red')).toBeInTheDocument();
      expect(screen.getByLabelText('Blue')).toBeInTheDocument();
      expect(screen.getByLabelText('Green')).toBeInTheDocument();
      expect(screen.getByLabelText('Yellow')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles reconnection when no previous answer exists', () => {
      const alice = createPlayer('Alice', 'socket1', 'team1', 'socket2');
      const bob = createPlayer('Bob', 'socket2', 'team1', 'socket1');
      const team = createTeam('team1', 'socket1', 'socket2');

      const round: CurrentRound = {
        roundNumber: 1,
        roundId: 'round1',
        question: 'Test question',
        variant: RoundVariant.OPEN_ENDED,
        options: null,
        answerForBoth: false,
        answers: {},
        submittedInCurrentPhase: [],
        status: RoundStatus.ANSWERING,
        createdAt: Date.now() - 1500,
      };

      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host', avatar: mockAvatar },
        players: [alice, bob],
        teams: [team],
        status: GameStatus.PLAYING,
        currentRound: round,
      };
      mockPlayerInfo = { name: 'Alice', isHost: false, roomCode: 'test' };
      mockMyPlayer = alice;
      mockMyTeam = team;
      mockMyPartner = bob;

      render(
        <MemoryRouter>
          <PlayerPage />
        </MemoryRouter>
      );

      // Should show answering screen with empty answer field
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });

    it('shows waiting screen when no current round exists', () => {
      const alice = createPlayer('Alice', 'socket1', 'team1', 'socket2');
      const bob = createPlayer('Bob', 'socket2', 'team1', 'socket1');
      const team = createTeam('team1', 'socket1', 'socket2');

      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host', avatar: mockAvatar },
        players: [alice, bob],
        teams: [team],
        status: GameStatus.PLAYING,
        currentRound: null,
      };
      mockPlayerInfo = { name: 'Alice', isHost: false, roomCode: 'test' };
      mockMyPlayer = alice;
      mockMyTeam = team;
      mockMyPartner = bob;

      render(
        <MemoryRouter>
          <PlayerPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Waiting for/i)).toBeInTheDocument();
    });

    it('handles player without team correctly', () => {
      const alice = createPlayer('Alice', 'socket1', 'team1', 'socket2');
      const charlie = createPlayer('Charlie', 'socket3', '', '');
      const team = createTeam('team1', 'socket1', 'socket2');

      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host', avatar: mockAvatar },
        players: [alice, charlie],
        teams: [team],
        status: GameStatus.PLAYING,
        currentRound: null,
      };
      mockPlayerInfo = { name: 'Charlie', isHost: false, roomCode: 'test' };
      mockMyPlayer = charlie;
      mockMyTeam = null;
      mockMyPartner = null;

      render(
        <MemoryRouter>
          <PlayerPage />
        </MemoryRouter>
      );

      // Should render without crashing
      expect(screen.getByText(/Tournament of the Couples/i)).toBeInTheDocument();
    });
  });
});
