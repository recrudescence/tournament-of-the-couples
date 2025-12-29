import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { JoinPage } from '../JoinPage';
import { LobbyPage } from '../LobbyPage';
import { GamePage } from '../GamePage';
import { HostPage } from '../HostPage';
import { PlayerPage } from '../PlayerPage';
import { FinishGamePage } from '../FinishGamePage';
import type { GameState, Player, Team } from '../../types/game';
import { GameStatus } from '../../types/game';

// Mock implementations
const mockNavigate = vi.fn();
const mockEmit = vi.fn();
const mockOn = vi.fn(() => vi.fn()); // Returns unsubscribe function
const mockDispatch = vi.fn();
const mockSavePlayerInfo = vi.fn();
const mockClearPlayerInfo = vi.fn();
const mockShowError = vi.fn();

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
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/', state: null }),
    useSearchParams: () => [new URLSearchParams('room=test'), vi.fn()],
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
    savePlayerInfo: mockSavePlayerInfo,
    clearPlayerInfo: mockClearPlayerInfo,
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
    playerInfo: mockPlayerInfo,
    dispatch: mockDispatch,
    roundPhase: 'initial' as const,
    myPlayer: mockMyPlayer,
    myTeam: mockMyTeam,
    myPartner: mockMyPartner,
  }),
}));

vi.mock('../../hooks/useWakeLock', () => ({
  useWakeLock: () => ({
    requestWakeLock: vi.fn(),
    isSupported: true,
  }),
}));

describe('Page Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGameState = null;
    mockPlayerInfo = null;
    mockMyPlayer = null;
    mockMyTeam = null;
    mockMyPartner = null;
  });

  describe('JoinPage', () => {
    it('renders without crashing', () => {
      render(
        <MemoryRouter>
          <JoinPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Tournament of the Couples/i)).toBeInTheDocument();
    });

    it('shows current rooms section when connected', () => {
      render(
        <MemoryRouter>
          <JoinPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Current Rooms/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Room/i })).toBeInTheDocument();
    });
  });

  describe('LobbyPage', () => {
    it('renders loading state without game state', () => {
      render(
        <MemoryRouter>
          <LobbyPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });

    it('renders lobby with game state', () => {
      const player: Player = {
        socketId: 'socket1',
        name: 'TestPlayer',
        connected: true,
        partnerId: null,
        teamId: null,
      };

      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host' },
        players: [player],
        teams: [],
        status: GameStatus.LOBBY,
        currentRound: null,
      };
      mockPlayerInfo = { name: 'TestPlayer', isHost: false, roomCode: 'test' };
      mockMyPlayer = player;

      render(
        <MemoryRouter>
          <LobbyPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Lobby/i)).toBeInTheDocument();
    });
  });

  describe('GamePage', () => {
    beforeEach(() => {
      mockPlayerInfo = { name: 'TestPlayer', isHost: false, roomCode: 'test' };
    });

    it('renders loading state without game state', () => {
      render(
        <MemoryRouter initialEntries={['/game?room=test']}>
          <Routes>
            <Route path="/game" element={<GamePage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText(/Loading game/i)).toBeInTheDocument();
    });

    it('renders lobby page when status is lobby', () => {
      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host' },
        players: [],
        teams: [],
        status: GameStatus.LOBBY,
        currentRound: null,
      };

      const { container } = render(
        <MemoryRouter initialEntries={['/game?room=test']}>
          <Routes>
            <Route path="/game" element={<GamePage />} />
          </Routes>
        </MemoryRouter>
      );

      // Should render LobbyPage content
      expect(container).toBeTruthy();
      expect(screen.queryByText(/Loading/i) || screen.queryByText(/Lobby/i)).toBeTruthy();
    });
  });

  describe('HostPage', () => {
    it('renders without crashing', () => {
      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host' },
        players: [],
        teams: [],
        status: GameStatus.PLAYING,
        currentRound: null,
      };
      mockPlayerInfo = { name: 'Host', isHost: true, roomCode: 'test' };

      const { container } = render(
        <MemoryRouter>
          <HostPage />
        </MemoryRouter>
      );

      // Should render without crashing - check that page has content
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('PlayerPage', () => {
    it('renders without crashing', () => {
      const player: Player = {
        socketId: 'socket1',
        name: 'TestPlayer',
        connected: true,
        partnerId: 'socket2',
        teamId: 'team1',
      };

      const partner: Player = {
        socketId: 'socket2',
        name: 'Partner',
        connected: true,
        partnerId: 'socket1',
        teamId: 'team1',
      };

      const team: Team = {
        teamId: 'team1',
        player1Id: 'socket1',
        player2Id: 'socket2',
        score: 0,
      };

      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host' },
        players: [player, partner],
        teams: [team],
        status: GameStatus.PLAYING,
        currentRound: null,
      };
      mockPlayerInfo = { name: 'TestPlayer', isHost: false, roomCode: 'test' };
      mockMyPlayer = player;
      mockMyTeam = team;
      mockMyPartner = partner;

      render(
        <MemoryRouter>
          <PlayerPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Waiting for/i)).toBeInTheDocument();
    });
  });

  describe('FinishGamePage', () => {
    it('renders without crashing', () => {
      const player1: Player = {
        socketId: 'socket1',
        name: 'Alice',
        connected: true,
        partnerId: 'socket2',
        teamId: 'team1',
      };

      const player2: Player = {
        socketId: 'socket2',
        name: 'Bob',
        connected: true,
        partnerId: 'socket1',
        teamId: 'team1',
      };

      const team: Team = {
        teamId: 'team1',
        player1Id: 'socket1',
        player2Id: 'socket2',
        score: 5,
      };

      mockGameState = {
        roomCode: 'test',
        gameId: 'game1',
        host: { socketId: 'host1', name: 'Host' },
        players: [player1, player2],
        teams: [team],
        status: GameStatus.ENDED,
        currentRound: null,
      };
      mockPlayerInfo = { name: 'Alice', isHost: false, roomCode: 'test' };
      mockMyPlayer = player1;
      mockMyTeam = team;
      mockMyPartner = player2;

      render(
        <MemoryRouter>
          <FinishGamePage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Game Over/i)).toBeInTheDocument();
    });
  });
});
