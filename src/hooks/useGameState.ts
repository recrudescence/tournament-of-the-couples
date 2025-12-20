import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useGameContext } from '../context/GameContext';
import { RoundPhase } from '../types/game';

export function useGameState() {
  const { on } = useSocket();
  const { gameState, playerInfo, roundPhase, dispatch, myPlayer, myTeam, myPartner } =
    useGameContext();

  useEffect(() => {
    const unsubscribers = [
      on('gameCreated', ({ gameState }) => {
        dispatch({ type: 'SET_GAME_STATE', payload: gameState });
      }),
      on('joinSuccess', ({ gameState }) => {
        dispatch({ type: 'SET_GAME_STATE', payload: gameState });
      }),
      on('lobbyUpdate', (data) => {
        dispatch({ type: 'SET_GAME_STATE', payload: data });
      }),
      on('gameStarted', (data) => {
        dispatch({ type: 'SET_GAME_STATE', payload: data });
        dispatch({ type: 'SET_ROUND_PHASE', payload: RoundPhase.INITIAL });
      }),
      on('roundStarted', ({ gameState }) => {
        dispatch({ type: 'SET_GAME_STATE', payload: gameState });
        dispatch({ type: 'SET_ROUND_PHASE', payload: RoundPhase.IN_PROGRESS });
      }),
      on('scoreUpdated', ({ teamId, newScore }) => {
        dispatch({ type: 'UPDATE_TEAM_SCORE', payload: { teamId, newScore } });
      }),
      on('readyForNextRound', () => {
        dispatch({ type: 'SET_ROUND_PHASE', payload: RoundPhase.INITIAL });
      }),
      on('returnedToAnswering', ({ currentRound }) => {
        if (gameState) {
          dispatch({
            type: 'SET_GAME_STATE',
            payload: { ...gameState, currentRound },
          });
        }
        dispatch({ type: 'SET_ROUND_PHASE', payload: RoundPhase.IN_PROGRESS });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [on, dispatch, gameState]);

  const setPlayerInfo = (info: typeof playerInfo) => {
    dispatch({ type: 'SET_PLAYER_INFO', payload: info });
  };

  const setRoundPhase = (phase: RoundPhase) => {
    dispatch({ type: 'SET_ROUND_PHASE', payload: phase });
  };

  return {
    gameState,
    playerInfo,
    roundPhase,
    myPlayer,
    myTeam,
    myPartner,
    setPlayerInfo,
    setRoundPhase,
  };
}
