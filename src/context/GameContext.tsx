import { createContext, useContext, useReducer, useMemo, type ReactNode } from 'react';
import type { GameState, Player, Team, RoundPhase, PlayerInfo } from '../types/game';
import { findPlayerByName } from '../utils/playerUtils';

interface GameContextState {
  gameState: GameState | null;
  playerInfo: PlayerInfo | null;
  roundPhase: RoundPhase;
}

type GameAction =
  | { type: 'SET_GAME_STATE'; payload: GameState }
  | { type: 'SET_PLAYER_INFO'; payload: PlayerInfo | null }
  | { type: 'SET_ROUND_PHASE'; payload: RoundPhase }
  | { type: 'UPDATE_PLAYERS'; payload: Player[] }
  | { type: 'UPDATE_TEAMS'; payload: Team[] }
  | { type: 'UPDATE_TEAM_SCORE'; payload: { teamId: string; newScore: number } }
  | { type: 'SET_PLAYER_CONNECTED'; payload: { socketId: string; connected: boolean } }
  | { type: 'RESET' };

function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.payload };
    case 'SET_PLAYER_INFO':
      return { ...state, playerInfo: action.payload };
    case 'SET_ROUND_PHASE':
      return { ...state, roundPhase: action.payload };
    case 'UPDATE_PLAYERS':
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: { ...state.gameState, players: action.payload },
      };
    case 'UPDATE_TEAMS':
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: { ...state.gameState, teams: action.payload },
      };
    case 'UPDATE_TEAM_SCORE':
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          teams: state.gameState.teams.map((team) =>
            team.teamId === action.payload.teamId
              ? { ...team, score: action.payload.newScore }
              : team
          ),
        },
      };
    case 'SET_PLAYER_CONNECTED':
      if (!state.gameState) return state;
      return {
        ...state,
        gameState: {
          ...state.gameState,
          players: state.gameState.players.map((player) =>
            player.socketId === action.payload.socketId
              ? { ...player, connected: action.payload.connected }
              : player
          ),
        },
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const initialState: GameContextState = {
  gameState: null,
  playerInfo: null,
  roundPhase: 'initial' as RoundPhase,
};

interface GameContextValue extends GameContextState {
  dispatch: React.Dispatch<GameAction>;
  myPlayer: Player | null;
  myTeam: Team | null;
  myPartner: Player | null;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const myPlayer = useMemo(
    () =>
      state.gameState?.players && state.playerInfo?.name
        ? findPlayerByName(state.gameState.players, state.playerInfo.name) ?? null
        : null,
    [state.gameState?.players, state.playerInfo?.name]
  );

  const myTeam = useMemo(
    () =>
      myPlayer?.teamId
        ? state.gameState?.teams.find((t) => t.teamId === myPlayer.teamId) ?? null
        : null,
    [myPlayer?.teamId, state.gameState?.teams]
  );

  // Use teamId + name for partner lookup (more stable than partnerId which is a socket ID)
  const myPartner = useMemo(
    () =>
      myPlayer?.teamId && state.gameState?.players
        ? state.gameState.players.find(
            (p) => p.teamId === myPlayer.teamId && p.name !== myPlayer.name
          ) ?? null
        : null,
    [myPlayer?.teamId, myPlayer?.name, state.gameState?.players]
  );

  return (
    <GameContext.Provider
      value={{
        ...state,
        dispatch,
        myPlayer,
        myTeam,
        myPartner,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
}
