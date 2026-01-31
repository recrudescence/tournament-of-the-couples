import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import { useGameError } from '../hooks/useGameError';
import { LobbyPage } from './LobbyPage';
import { HostPage } from './HostPage';
import { PlayerPage } from './PlayerPage';
import { FinishGamePage } from './FinishGamePage';
import { GameTitle } from '../components/common/GameTitle';

export function GamePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isConnected, emit, on } = useSocket();
  const { playerInfo, clearPlayerInfo } = usePlayerInfo();
  const { gameState, dispatch } = useGameContext();
  const { showError } = useGameError();

  const [hasJoined, setHasJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const roomCode = searchParams.get('room');

  const validateRoomCode = (code: string | null): code is string => {
    return code !== null && /^[a-z]+$/.test(code);
  };

  // Route guards - only redirect for invalid room codes or mismatched room codes
  // Missing playerInfo is handled by showing loading state and redirecting after a delay
  useEffect(() => {
    // Validate room code format
    if (!validateRoomCode(roomCode)) {
      navigate('/');
      return;
    }

    // If room code in URL doesn't match sessionStorage, redirect to home
    if (playerInfo?.roomCode && playerInfo.roomCode !== roomCode) {
      navigate('/');
      return;
    }
  }, [roomCode, playerInfo, navigate]);

  // Delayed redirect if playerInfo is missing (gives sessionStorage time to load)
  // Don't redirect if we already have gameState (active session)
  useEffect(() => {
    if (!validateRoomCode(roomCode)) return;
    if (playerInfo?.name && playerInfo?.roomCode) return;
    if (gameState) return; // Don't redirect if we have an active game session

    // Wait a moment before redirecting in case sessionStorage is still loading
    const timeout = setTimeout(() => {
      navigate('/');
    }, 100);

    return () => clearTimeout(timeout);
  }, [roomCode, playerInfo, gameState, navigate]);

  // Handle socket events for GamePage coordination
  useEffect(() => {
    const unsubscribers = [
      on('joinSuccess', ({ gameState: state }) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        setJoinError(null); // Clear any previous errors
      }),

      on('gameEnded', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('error', ({ message }) => {
        // If we haven't joined yet (no gameState), this is a join error
        if (!gameState) {
          setJoinError(message);
        } else {
          // For other errors, just show them
          showError(message);
        }
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, dispatch, gameState, showError]);

  // Handle join errors - redirect to home with error message
  useEffect(() => {
    if (joinError) {
      clearPlayerInfo();
      navigate('/', { state: { error: joinError } });
    }
  }, [joinError, navigate, clearPlayerInfo]);

  // Auto-rejoin on mount/refresh (only if we don't have gameState yet)
  useEffect(() => {
    if (!isConnected || !playerInfo || !roomCode || hasJoined) return;

    // If we already have gameState, we've already joined (came from JoinPage)
    // Only auto-join if gameState is null (page refresh scenario)
    if (gameState) {
      setHasJoined(true);
      return;
    }

    emit('joinGame', {
      name: playerInfo.name,
      isHost: playerInfo.isHost,
      isReconnect: false,
      roomCode,
    });
    setHasJoined(true);
  }, [isConnected, playerInfo, roomCode, hasJoined, gameState, emit]);

  // Loading state while we wait for gameState
  if (!gameState) {
    return (
      <div className="container">
        <GameTitle />
        <p>Loading game...</p>
      </div>
    );
  }

  // Render appropriate view based on game state and player role
  if (gameState.status === 'ended') {
    return <FinishGamePage />;
  } else if (gameState.status === 'lobby') {
    return <LobbyPage />;
  } else if (playerInfo?.isHost) {
    return <HostPage />;
  } else {
    return <PlayerPage />;
  }
}
