import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import type { Player } from '../types/game';

type JoinStep = 'menu' | 'roomCode' | 'nameInput' | 'reconnect' | 'gameCreated';

export function JoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isConnected, emit, on } = useSocket();
  const { savePlayerInfo } = usePlayerInfo();
  const { dispatch } = useGameContext();

  const [step, setStep] = useState<JoinStep>('menu');
  const [hostName, setHostName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [createdRoomCode, setCreatedRoomCode] = useState('');
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const showError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  const validateRoomCode = (code: string) => {
    return code.length === 4 && /^[a-z]+$/.test(code);
  };

  // Handle pre-filled room code from URL query param
  useEffect(() => {
    const roomCodeParam = searchParams.get('room');
    if (roomCodeParam && validateRoomCode(roomCodeParam.toLowerCase())) {
      const code = roomCodeParam.toLowerCase();
      setRoomCode(code);
      setIsLoading(true);
      // Auto-check room status when room code is pre-filled
      emit('checkRoomStatus', { roomCode: code });
    }
  }, [searchParams, emit]);

  // Socket event handlers
  useEffect(() => {
    const unsubscribers = [
      on('gameCreated', ({ roomCode, name, gameState }) => {
        savePlayerInfo({ name, isHost: true, roomCode });
        dispatch({ type: 'SET_GAME_STATE', payload: gameState });
        dispatch({ type: 'SET_PLAYER_INFO', payload: { name, isHost: true, roomCode } });
        setCreatedRoomCode(roomCode.toUpperCase());
        setStep('gameCreated');
        setIsLoading(false);
      }),

      on('roomStatus', ({ found, error: roomError, roomCode: code, inProgress, disconnectedPlayers: players }) => {
        setIsLoading(false);

        if (!found) {
          showError(roomError ?? 'Room not found');
          return;
        }

        setRoomCode(code);

        if (inProgress) {
          if (players.length === 0) {
            showError('Cannot join game in progress. No disconnected players available.');
            return;
          }
          setDisconnectedPlayers(players);
          setStep('reconnect');
        } else {
          setStep('nameInput');
        }
      }),

      on('joinSuccess', ({ roomCode, name, isHost, gameState }) => {
        savePlayerInfo({ name, isHost, roomCode });
        dispatch({ type: 'SET_GAME_STATE', payload: gameState });
        dispatch({ type: 'SET_PLAYER_INFO', payload: { name, isHost, roomCode } });
        setIsLoading(false);
        navigate(`/game?room=${roomCode}`);
      }),

      on('error', ({ message }) => {
        showError(message);
        setIsLoading(false);
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, savePlayerInfo, dispatch, navigate, showError]);

  const handleCreateGame = () => {
    const name = hostName.trim();
    if (!name) {
      showError('Please enter your name');
      return;
    }
    setIsLoading(true);
    emit('createGame', { name });
  };

  const handleCheckRoom = () => {
    const code = roomCode.trim().toLowerCase();
    if (!code) {
      showError('Please enter a room code');
      return;
    }
    if (!validateRoomCode(code)) {
      showError('Room code must be 4 letters');
      return;
    }
    setRoomCode(code);
    setIsLoading(true);
    emit('checkRoomStatus', { roomCode: code });
  };

  const handleJoinGame = () => {
    const name = playerName.trim();
    if (!name) {
      showError('Please enter your name');
      return;
    }
    setIsLoading(true);
    emit('joinGame', {
      name,
      isHost: false,
      isReconnect: false,
      roomCode,
    });
  };

  const handleReconnect = (name: string) => {
    setIsLoading(true);
    emit('joinGame', {
      name,
      isHost: false,
      isReconnect: true,
      roomCode,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  if (!isConnected) {
    return (
      <div className="container">
        <h1>Tournament of the Couples</h1>
        <p>Connecting...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Tournament of the Couples</h1>

      {step === 'menu' && (
        <>
          <div className="form-section">
            <h2>Start New Game</h2>
            <div className="form-group">
              <label htmlFor="hostName">Your Name:</label>
              <input
                type="text"
                id="hostName"
                placeholder="Enter your name"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleCreateGame)}
              />
            </div>
            <button
              className="primary"
              onClick={handleCreateGame}
              disabled={isLoading}
            >
              Create Game
            </button>
          </div>

          <br /><br /><br />

          <div className="form-section">
            <h2>Join Existing Game</h2>
            <div className="form-group">
              <label htmlFor="joinRoomCode">Room Code:</label>
              <input
                type="text"
                id="joinRoomCode"
                placeholder="4 letters"
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toLowerCase())}
                onKeyPress={(e) => handleKeyPress(e, handleCheckRoom)}
              />
            </div>
            <button
              className="primary"
              onClick={handleCheckRoom}
              disabled={isLoading}
            >
              Continue
            </button>
          </div>
        </>
      )}

      {step === 'nameInput' && (
        <div className="form-section">
          <h2>Join Game</h2>
          <div className="form-group">
            <label htmlFor="joinPlayerName">Your Name:</label>
            <input
              type="text"
              id="joinPlayerName"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, handleJoinGame)}
              autoFocus
            />
          </div>
          <button
            className="primary"
            onClick={handleJoinGame}
            disabled={isLoading}
          >
            Join Game
          </button>
          <button
            className="secondary"
            onClick={() => {
              setStep('menu');
              setRoomCode('');
            }}
          >
            Back
          </button>
        </div>
      )}

      {step === 'reconnect' && (
        <div className="form-section">
          <h2>Reconnect to Game</h2>
          <p className="info-text">Game in progress. Select your name to reconnect:</p>
          <div className="disconnected-players-list">
            {disconnectedPlayers.map((player) => (
              <button
                key={player.socketId}
                className="player-button"
                onClick={() => handleReconnect(player.name)}
                disabled={isLoading}
              >
                {player.name}
              </button>
            ))}
          </div>
          <button
            className="secondary"
            onClick={() => {
              setStep('menu');
              setRoomCode('');
              setDisconnectedPlayers([]);
            }}
          >
            Back
          </button>
        </div>
      )}

      {step === 'gameCreated' && (
        <div className="form-section">
          <h2>Game Created!</h2>
          <div className="room-code-display">
            <p>Room Code:</p>
            <h1 className="room-code-large">{createdRoomCode}</h1>
          </div>
          <p>Share this code with players</p>
          <button className="primary" onClick={() => navigate(`/game?room=${createdRoomCode.toLowerCase()}`)}>
            Continue to Lobby
          </button>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
