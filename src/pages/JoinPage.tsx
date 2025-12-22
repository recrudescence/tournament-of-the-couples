import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';

type JoinStep = 'menu' | 'reconnect';

interface GameListItem {
  roomCode: string;
  hostName: string;
  status: string;
  playerCount: number;
  canJoin: boolean;
}

interface DisconnectedPlayer {
  name: string;
  socketId: string;
  isHost?: boolean;
}

export function JoinPage() {
  const navigate = useNavigate();
  const { isConnected, emit, on } = useSocket();
  const { savePlayerInfo } = usePlayerInfo();
  const { dispatch } = useGameContext();

  const [step, setStep] = useState<JoinStep>('menu');
  const [availableGames, setAvailableGames] = useState<GameListItem[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [selectedRoomCode, setSelectedRoomCode] = useState<string | null>(null);
  const [selectedGameHost, setSelectedGameHost] = useState<string>('');
  const [playerName, setPlayerName] = useState('');
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<DisconnectedPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [joiningExisting, setJoiningExisting] = useState(false);

  const showError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  // Fetch available games
  const fetchGames = async () => {
    setIsLoadingGames(true);
    try {
      const response = await fetch('/api/games');
      const data = await response.json();
      setAvailableGames(data.games);
    } catch (err) {
      console.error('Failed to fetch games:', err);
      showError('Failed to load games');
    } finally {
      setIsLoadingGames(false);
    }
  };

  // Load games on mount
  useEffect(() => {
    if (isConnected && step === 'menu' && !creatingNew && !joiningExisting) {
      fetchGames();
    }
  }, [isConnected, step, creatingNew, joiningExisting]);

  // Socket event handlers
  useEffect(() => {
    const unsubscribers = [
      on('gameCreated', ({ roomCode, name, gameState }) => {
        savePlayerInfo({ name, isHost: true, roomCode });
        dispatch({ type: 'SET_GAME_STATE', payload: gameState });
        dispatch({ type: 'SET_PLAYER_INFO', payload: { name, isHost: true, roomCode } });
        setIsLoading(false);
        navigate(`/game?room=${roomCode}`);
      }),

      on('roomStatus', ({ found, error: roomError, roomCode: _code, inProgress, disconnectedPlayers: players, canJoinAsNew }) => {
        setIsLoading(false);

        if (!found) {
          showError(roomError ?? 'Game not found');
          setSelectedRoomCode(null);
          setJoiningExisting(false);
          return;
        }

        if (inProgress && players.length > 0) {
          // Game in progress with disconnected players - show reconnect page
          setDisconnectedPlayers(players);
          setStep('reconnect');
        } else if (canJoinAsNew) {
          // Can join as new player - show name entry form
          setJoiningExisting(true);
        } else {
          showError('Cannot join this game');
          setSelectedRoomCode(null);
          setJoiningExisting(false);
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
  }, [on, savePlayerInfo, dispatch, navigate, showError, playerName]);

  const handleSelectGame = (roomCode: string, hostName: string, status: string) => {
    setSelectedRoomCode(roomCode);
    setSelectedGameHost(hostName);

    // If game is in progress, check status first (may show reconnect page)
    // If game is in lobby, show name entry form
    if (status === 'playing' || status === 'scoring') {
      setIsLoading(true);
      emit('checkRoomStatus', { roomCode });
    } else {
      setJoiningExisting(true);
    }
  };

  const handleStartOwnRoom = () => {
    setCreatingNew(true);
  };

  const handleBack = () => {
    setCreatingNew(false);
    setJoiningExisting(false);
    setPlayerName('');
    setSelectedRoomCode(null);
    setSelectedGameHost('');
    setStep('menu');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!playerName.trim()) {
      showError('Please enter your name');
      return;
    }

    setIsLoading(true);

    if (creatingNew) {
      emit('createGame', { name: playerName.trim() });
    } else if (joiningExisting && selectedRoomCode) {
      // For lobby games, directly join
      // For in-progress games, this won't be called (checkRoomStatus is called from handleSelectGame instead)
      emit('joinGame', {
        name: playerName.trim(),
        isHost: false,
        isReconnect: false,
        roomCode: selectedRoomCode,
      });
    }
  };

  const handleReconnect = (name: string, isHost: boolean = false) => {
    if (!selectedRoomCode) return;
    setIsLoading(true);
    emit('joinGame', {
      name,
      isHost,
      isReconnect: true,
      roomCode: selectedRoomCode,
    });
  };

  const formatGameStatus = (status: string): string => {
    switch (status) {
      case 'lobby':
        return 'In Lobby';
      case 'playing':
        return 'Playing';
      case 'scoring':
        return 'Scoring';
      case 'ended':
        return 'Ended';
      default:
        return status;
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

      {step === 'menu' && !creatingNew && !joiningExisting && (
        <div className="join-options">
          <div className="games-section">
            <div className="games-header">
              <h2>Current Rooms</h2>
              <button
                onClick={fetchGames}
                disabled={isLoadingGames}
                className="btn-refresh"
              >
                {isLoadingGames ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {availableGames.length === 0 ? (
              <p className="empty-state">No games currently open. Start your own!</p>
            ) : (
              <div className="games-list">
                {availableGames.map((game) => (
                  <button
                    key={game.roomCode}
                    onClick={() => handleSelectGame(game.roomCode, game.hostName, game.status)}
                    disabled={!game.canJoin}
                    className={`game-button ${!game.canJoin ? 'disabled' : ''}`}
                  >
                    <div className="game-info">
                      <span className="game-name">{game.hostName}'s Game</span>
                      <span className="game-status">{formatGameStatus(game.status)}</span>
                    </div>
                    {!game.canJoin && <span className="game-ended-badge">Ended</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="divider">
            <span>or</span>
          </div>

          <button onClick={handleStartOwnRoom} className="btn-primary btn-large">
            Create Room
          </button>
        </div>
      )}

      {(creatingNew || joiningExisting) && step === 'menu' && (
        <div className="name-entry">
          <h2>{creatingNew ? 'Create Your Room' : `Join ${selectedGameHost}'s Game`}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="nameInput">Enter Your Name:</label>
              <input
                id="nameInput"
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={handleBack} className="btn-secondary" disabled={isLoading}>
                Back
              </button>
              <button type="submit" className="btn-primary" disabled={isLoading}>
                {creatingNew ? 'Create Room' : 'Join Game'}
              </button>
            </div>
          </form>
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
                onClick={() => handleReconnect(player.name, player.isHost ?? false)}
                disabled={isLoading}
              >
                {player.name}{player.isHost ? ' (Host)' : ''}
              </button>
            ))}
          </div>
          <button
            className="secondary"
            onClick={() => {
              setStep('menu');
              setPlayerName('');
              setDisconnectedPlayers([]);
              setJoiningExisting(false);
              setSelectedRoomCode(null);
            }}
          >
            Back
          </button>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
