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

  // Route guards
  useEffect(() => {
    // Validate room code format
    if (!validateRoomCode(roomCode)) {
      navigate('/');
      return;
    }

    // Validate player info exists
    if (!playerInfo?.name || !playerInfo?.roomCode) {
      navigate(`/?room=${roomCode}`);
      return;
    }

    // If room code in URL doesn't match sessionStorage, redirect to join with new code
    if (playerInfo.roomCode !== roomCode) {
      navigate(`/?room=${roomCode}`);
      return;
    }
  }, [roomCode, playerInfo, navigate]);

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
        <h1 className="title has-text-centered">💝 Tournament of the Couples 💝</h1>
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
