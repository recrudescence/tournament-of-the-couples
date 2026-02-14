import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {AnimatePresence} from 'framer-motion';
import {useSocket} from '../hooks/useSocket';
import {usePlayerInfo} from '../hooks/usePlayerInfo';
import {useGameContext} from '../context/GameContext';
import {useGameError} from '../hooks/useGameError';
import {useWakeLock} from '../hooks/useWakeLock';
import {useSnowEffect} from '../hooks/useConfetti';
import {useTheme} from '../hooks/useTheme';
import {useAlert} from '../context/AlertContext';
import {ThemePicker} from '../components/common/ThemePicker';
import {ExitButton} from '../components/common/ExitButton';
import {PlayerAvatar} from '../components/common/PlayerAvatar';
import {PlayerCard} from '../components/common/PlayerCard';
import {TeamCard} from '../components/common/TeamCard';
import type {Player, Team} from '../types/game';
import {findPlayerBySocketId} from '../utils/playerUtils';

interface ImportedInfo {
  title: string;
  questionCount: number;
  chapterCount: number;
}

export function LobbyPage() {
  const navigate = useNavigate();
  const { isReconnecting, reconnectCount, emit, on } = useSocket();
  const { playerInfo, clearPlayerInfo } = usePlayerInfo();
  const { gameState, dispatch, myPlayer } = useGameContext();
  const { error, showError } = useGameError();
  const { theme } = useTheme();
  const { confirm } = useAlert();
  const { requestWakeLock } = useWakeLock();

  // Add snow effect for holiday theme
  useSnowEffect(theme === 'holiday');

  // Request wake lock to prevent screen sleep while in lobby
  useEffect(() => {
    requestWakeLock();
  }, [requestWakeLock]);

  // Socket event handlers
  useEffect(() => {
    const unsubscribers = [
      on('joinSuccess', ({ gameState: state }) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('lobbyUpdate', (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('gameStarted', (state) => {
        // Update game state when game starts (GamePage will handle view transition)
        dispatch({ type: 'SET_GAME_STATE', payload: state });
      }),

      on('playerKicked', () => {
        // Player was kicked by host - clear their info and redirect to join page
        clearPlayerInfo();
        navigate('/', { state: { kicked: true } });
      }),

      on('gameCancelled', ({ reason }) => {
        // Game was canceled (host left lobby) - clear info and redirect
        clearPlayerInfo();
        navigate('/', { state: { error: reason } });
      }),

      on('error', ({ message }) => {
        showError(message);
      }),

      on('questionsImported', ({ title, questionCount, chapterCount }) => {
        setImportedInfo({ title, questionCount, chapterCount });
        setImportError(null);
      }),

      on('questionsCleared', () => {
        setImportedInfo(null);
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, dispatch, showError, clearPlayerInfo, navigate]);

  // Derive imported info from gameState on mount/reconnect
  useEffect(() => {
    if (gameState?.importedQuestions) {
      const qs = gameState.importedQuestions;
      const questionCount = qs.chapters.reduce((t, c) => t + c.questions.length, 0);
      setImportedInfo({
        title: qs.title,
        questionCount,
        chapterCount: qs.chapters.length
      });
    }
  }, [gameState?.importedQuestions]);

  // Check if player has been removed from the lobby (disconnect/refresh)
  useEffect(() => {
    if (!playerInfo || !gameState) return;

    // Skip check for host
    if (playerInfo.isHost) return;

    // If player is no longer in the game state, they were removed
    if (!myPlayer) {
      clearPlayerInfo();
      navigate('/');
    }
  }, [playerInfo, gameState, myPlayer, clearPlayerInfo, navigate]);

  // Re-join lobby on socket reconnection (handles network drops)
  useEffect(() => {
    if (reconnectCount > 0 && playerInfo?.roomCode) {
      console.log('Socket reconnected, re-joining lobby...');
      emit('joinGame', {
        roomCode: playerInfo.roomCode,
        name: playerInfo.name,
        isHost: playerInfo.isHost,
        isReconnect: true,
      });
    }
  }, [reconnectCount, playerInfo, emit]);

  const handlePair = (targetSocketId: string) => {
    emit('requestPair', { targetSocketId });
  };

  const handleUnpair = () => {
    emit('unpair');
  };

  const handleKick = async (targetSocketId: string, playerName: string) => {
    const confirmed = await confirm({
      message: `are you sure you want to kick ${playerName}?`,
      variant: 'danger',
      confirmText: 'kick',
    });
    if (confirmed) {
      emit('kickPlayer', { targetSocketId });
    }
  };

  const handleStartGame = () => {
    emit('startGame');
  };

  const handleRandomizeAvatar = () => {
    emit('randomizeAvatar');
  };

  const [botCount] = useState(2);

  // Question import state
  const [importedInfo, setImportedInfo] = useState<ImportedInfo | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddBots = () => {
    emit('addBots', { count: botCount });
  };

  const handleRemoveBots = () => {
    emit('removeBots');
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !playerInfo?.roomCode) return;

    setIsUploading(true);
    setImportError(null);

    try {
      const content = await file.text();

      const response = await fetch(`/api/games/${playerInfo.roomCode}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      const data = await response.json();

      if (!response.ok) {
        setImportError(data.error || 'Failed to import questions');
      }
      // Success state is set via socket event
    } catch (err) {
      setImportError('Failed to upload file: ' + err);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [playerInfo?.roomCode]);

  const handleClearQuestions = useCallback(async () => {
    if (!playerInfo?.roomCode) return;

    try {
      await fetch(`/api/games/${playerInfo.roomCode}/questions`, {
        method: 'DELETE'
      });
      // Success state is set via socket event
    } catch (err) {
      setImportError('Failed to clear questions: ' + err);
    }
  }, [playerInfo?.roomCode]);

  // For host, create a player-like object; for players, use myPlayer from context
  const currentPlayer = useMemo(() => {
    if (!playerInfo || !gameState) return null;
    return playerInfo.isHost
      ? { ...gameState.host, isHost: true, partnerId: null, teamId: null, connected: true, name: gameState.host.name, socketId: gameState.host.socketId }
      : myPlayer;
  }, [playerInfo, gameState, myPlayer]);

  const connectedPlayers = useMemo(
    () => gameState?.players.filter((p) => p.connected) ?? [],
    [gameState?.players]
  );

  // Separate unpaired players from paired ones
  const unpairedPlayers = useMemo(() => {
    if (!gameState) return [];
    const pairedIds = new Set<string>();
    gameState.teams.forEach((team) => {
      pairedIds.add(team.player1Id);
      pairedIds.add(team.player2Id);
    });
    return connectedPlayers.filter((p) => !pairedIds.has(p.socketId));
  }, [connectedPlayers, gameState]);

  // Sort unpaired players: current player first, then alpha descending (Z-A)
  const sortedUnpairedPlayers = useMemo(() => {
    const currentPlayerSocketId = currentPlayer?.socketId;
    return [...unpairedPlayers].sort((a, b) => {
      if (a.socketId === currentPlayerSocketId) return -1;
      if (b.socketId === currentPlayerSocketId) return 1;
      return b.name.localeCompare(a.name); // descending
    });
  }, [unpairedPlayers, currentPlayer?.socketId]);

  // Sort teams: current player's team first, then by team name
  const sortedTeams = useMemo(() => {
    if (!gameState) return [];
    const currentPlayerSocketId = currentPlayer?.socketId;
    return [...gameState.teams].sort((a, b) => {
      const aHasCurrent = a.player1Id === currentPlayerSocketId || a.player2Id === currentPlayerSocketId;
      const bHasCurrent = b.player1Id === currentPlayerSocketId || b.player2Id === currentPlayerSocketId;
      if (aHasCurrent && !bHasCurrent) return -1;
      if (bHasCurrent && !aHasCurrent) return 1;
      return 0;
    });
  }, [gameState, currentPlayer?.socketId]);

  // Check if game can start
  const connectedNonHostPlayers = useMemo(
    () => gameState?.players.filter(
      (p) => p.name !== gameState.host?.name && p.connected
    ) ?? [],
    [gameState]
  );

  const allPaired = useMemo(
    () =>
      connectedNonHostPlayers.length > 0 &&
      connectedNonHostPlayers.length === (gameState?.teams.length ?? 0) * 2,
    [connectedNonHostPlayers.length, gameState?.teams.length]
  );

  // Split players/teams for player view: separate "you" from others
  const currentPlayerUnpaired = useMemo(() => {
    if (!playerInfo || playerInfo.isHost) return null;
    return sortedUnpairedPlayers.find(p => p.socketId === currentPlayer?.socketId) || null;
  }, [sortedUnpairedPlayers, currentPlayer?.socketId, playerInfo]);

  const otherUnpairedPlayers = useMemo(() => {
    if (!playerInfo || playerInfo.isHost) return sortedUnpairedPlayers;
    return sortedUnpairedPlayers.filter(p => p.socketId !== currentPlayer?.socketId);
  }, [sortedUnpairedPlayers, currentPlayer?.socketId, playerInfo]);

  const currentTeam = useMemo(() => {
    if (!playerInfo || playerInfo.isHost) return null;
    return sortedTeams.find(t =>
      t.player1Id === currentPlayer?.socketId || t.player2Id === currentPlayer?.socketId
    ) || null;
  }, [sortedTeams, currentPlayer?.socketId, playerInfo]);

  const otherTeams = useMemo(() => {
    if (!playerInfo || playerInfo.isHost) return sortedTeams;
    return sortedTeams.filter(t =>
      t.player1Id !== currentPlayer?.socketId && t.player2Id !== currentPlayer?.socketId
    );
  }, [sortedTeams, currentPlayer?.socketId, playerInfo]);

  if (!playerInfo || !gameState) {
    return (
      <section className="section">
        <div className="container container-md">
          <h1 className="title">Lobby</h1>
          <p>Loading...</p>
        </div>
      </section>
    );
  }

  const playerCount = connectedPlayers.length;
  const teamCount = gameState.teams.length;

  const renderTeamCard = (team: Team, index: number, size: 'normal' | 'large' = 'normal') => {
    const player1 = findPlayerBySocketId(gameState.players, team.player1Id);
    const player2 = findPlayerBySocketId(gameState.players, team.player2Id);

    if (!player1 || !player2) return null;

    const isCurrentPlayerInTeam =
      currentPlayer &&
      (player1.socketId === currentPlayer.socketId || player2.socketId === currentPlayer.socketId);

    const canUnpair = Boolean(isCurrentPlayerInTeam && !playerInfo.isHost);

    return (
      <TeamCard
        key={team.teamId}
        player1={player1}
        player2={player2}
        currentPlayerName={currentPlayer?.name || null}
        isHost={playerInfo.isHost}
        isViewerTeam={Boolean(isCurrentPlayerInTeam)}
        canUnpair={canUnpair}
        index={index}
        size={size}
        onUnpair={handleUnpair}
        onKick={handleKick}
        onRandomizeAvatar={isCurrentPlayerInTeam ? handleRandomizeAvatar : undefined}
      />
    );
  };

  const renderUnpairedPlayer = (player: Player, index: number, size: 'normal' | 'large' = 'normal') => {
    const isCurrentPlayer = currentPlayer && player.socketId === currentPlayer.socketId;
    const canPair =
      !isCurrentPlayer &&
      currentPlayer &&
      !playerInfo.isHost &&
      !currentPlayer.partnerId;

    return (
      <PlayerCard
        key={player.socketId}
        player={player}
        isCurrentPlayer={Boolean(isCurrentPlayer)}
        canPair={Boolean(canPair)}
        isHost={playerInfo.isHost}
        index={index}
        size={size}
        onPair={handlePair}
        onKick={handleKick}
        onRandomizeAvatar={isCurrentPlayer ? handleRandomizeAvatar : undefined}
      />
    );
  };

  return (
    <>
      <ExitButton />
      <section className="section">
        <div className="container container-md">
          {playerInfo.isHost ? (
            <div className="mb-5">
              <div className="is-flex is-align-items-center is-justify-content-space-between">
                <div className="is-flex is-align-items-center">
                  <PlayerAvatar
                    avatar={gameState.host.avatar}
                    size="large"
                    onClick={handleRandomizeAvatar}
                    title="Click to randomize"
                  />
                  <div className="ml-3 mb-0">
                    <span className="title is-4">
                      {gameState.host.name} is hosting a Tournament of the Couples!
                    </span>
                    <p>Scan the QR code or go to <i>www.feud.love</i> 💕</p>
                  </div>
                </div>
                <div className="box p-5">
                  <figure className="image is-96x96">
                    <img src="/feudlove.svg" alt="Scan to join" />
                  </figure>
                </div>
              </div>
            </div>
          ) : (
            <div className="block">
              <h1 className="title has-text-centered">Lobby</h1>
              <p className="subtitle is-6 has-text-centered">
                Welcome to <strong>{gameState.host.name}</strong>'s game!
              </p>
            </div>
          )}

          {isReconnecting && (
            <div className="notification is-warning has-text-centered">
              Connection lost - reconnecting...
            </div>
          )}

          <div className="notification is-info is-light has-text-centered">
            {playerCount} player{playerCount !== 1 ? 's' : ''} connected, {teamCount} team
            {teamCount !== 1 ? 's' : ''} formed
          </div>

          <div className="columns mb-5">
            <div className="column has-text-centered">
              <h2 className="subtitle is-5 mb-3">Singles</h2>
              <AnimatePresence mode="sync">
                {/* Current player on own row (large) - player view only */}
                {currentPlayerUnpaired && (
                  <div className="mb-4">
                    {renderUnpairedPlayer(currentPlayerUnpaired, 0, 'large')}
                  </div>
                )}
                {/* Other unpaired players */}
                {otherUnpairedPlayers.length > 0 ? (
                  otherUnpairedPlayers.map((player, index) =>
                    renderUnpairedPlayer(player, index + 1, 'normal')
                  )
                ) : !currentPlayerUnpaired ? (
                  <p className="has-text-grey-light is-italic">No singles mingling</p>
                ) : null}
              </AnimatePresence>
            </div>
            <div className="column has-text-centered">
              <h2 className="subtitle is-5 mb-3">Couples</h2>
              <AnimatePresence mode="sync">
                {/* Current player's team on own row (large) - player view only */}
                {currentTeam && (
                  <div className="mb-4">
                    {renderTeamCard(currentTeam, 0, 'large')}
                  </div>
                )}
                {/* Other teams */}
                {otherTeams.length > 0 ? (
                  otherTeams.map((team, index) =>
                    renderTeamCard(team, index + 1, 'normal')
                  )
                ) : !currentTeam ? (
                  <p className="has-text-grey-light is-italic">No teams coupled up yet</p>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {playerInfo.isHost && (
            <div className="box has-background-primary-light">
              <p className={`notification ${allPaired ? 'is-success' : 'is-warning'} is-light has-text-centered mt-0`}>
                {allPaired
                    ? 'Ready to start!'
                    : 'All connected players must be paired before starting the game.'}
              </p>

              <button
                className="button is-primary is-fullwidth is-large mb-3"
                onClick={handleStartGame}
                disabled={!allPaired}
              >
                Start Game
              </button>

              <div className="is-flex is-align-items-center is-justify-content-center is-flex-wrap-wrap mb-3" style={{ gap: '1rem' }}>
                <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                  <span className="has-text-weight-bold">{'\u{1F916}'} Bots:</span>
                  <button className="button is-small is-info" onClick={handleAddBots}>
                    Add
                  </button>
                  {gameState.players.some(p => p.isBot) && (
                    <button className="button is-small is-danger is-light" onClick={handleRemoveBots}>
                      Remove All
                    </button>
                  )}
                </div>

                <span className="has-text-grey-light">|</span>

                <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
                  <span className="has-text-weight-bold">{'\u{1F4CB}'} Questions:</span>
                  {importedInfo ? (
                    <>
                      <span className="has-text-grey is-size-7">
                        {importedInfo.title} ({importedInfo.questionCount}q / {importedInfo.chapterCount}ch)
                      </span>
                      <button className="button is-small is-danger is-light" onClick={handleClearQuestions}>
                        Clear
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        id="question-file-input"
                      />
                      <label
                        htmlFor="question-file-input"
                        className={`button is-small is-info ${isUploading ? 'is-loading' : ''}`}
                      >
                        Upload JSON
                      </label>
                    </>
                  )}
                </div>
              </div>
              {importError && (
                <div className="notification is-danger is-light mb-3 p-3 has-text-centered">
                  {importError}
                </div>
              )}
            </div>
          )}

          {error && <div className="notification is-danger is-light">{error}</div>}

          <ThemePicker />
        </div>
      </section>
    </>
  );
}
