import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import { useGameError } from '../hooks/useGameError';
import { useSnowEffect } from '../hooks/useConfetti';
import { useTheme } from '../hooks/useTheme';
import { DebugSidebar } from '../components/common/DebugSidebar';
import { ExitButton } from '../components/common/ExitButton';
import { PlayerCard } from '../components/common/PlayerCard';
import { TeamCard } from '../components/common/TeamCard';
import type { Player, Team } from '../types/game';
import { findPlayerBySocketId } from '../utils/playerUtils';

export function LobbyPage() {
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  const { playerInfo, clearPlayerInfo } = usePlayerInfo();
  const { gameState, dispatch, myPlayer } = useGameContext();
  const { error, showError } = useGameError();
  const { theme } = useTheme();

  // Add snow effect for holiday theme
  useSnowEffect(theme === 'holiday');

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
        navigate('/');
      }),

      on('gameCancelled', () => {
        // Game was canceled (host left lobby) - clear info and redirect
        clearPlayerInfo();
        navigate('/');
      }),

      on('error', ({ message }) => {
        showError(message);
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, dispatch, showError, clearPlayerInfo, navigate]);

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

  const handlePair = (targetSocketId: string) => {
    emit('requestPair', { targetSocketId });
  };

  const handleUnpair = () => {
    emit('unpair');
  };

  const handleKick = (targetSocketId: string, playerName: string) => {
    if (window.confirm(`Are you sure you want to kick ${playerName}?`)) {
      emit('kickPlayer', { targetSocketId });
    }
  };

  const handleStartGame = () => {
    emit('startGame');
  };

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

  // For host, create a player-like object; for players, use myPlayer from context
  const currentPlayer = playerInfo.isHost
    ? { ...gameState.host, isHost: true, partnerId: null, teamId: null, connected: true, name: gameState.host.name, socketId: gameState.host.socketId }
    : myPlayer;

  const connectedPlayers = useMemo(
    () => gameState.players.filter((p) => p.connected),
    [gameState.players]
  );

  const playerCount = connectedPlayers.length;
  const teamCount = gameState.teams.length;

  // Separate unpaired players from paired ones
  const unpairedPlayers = useMemo(() => {
    const pairedIds = new Set<string>();
    gameState.teams.forEach((team) => {
      pairedIds.add(team.player1Id);
      pairedIds.add(team.player2Id);
    });
    return connectedPlayers.filter((p) => !pairedIds.has(p.socketId));
  }, [connectedPlayers, gameState.teams]);

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
    const currentPlayerSocketId = currentPlayer?.socketId;
    return [...gameState.teams].sort((a, b) => {
      const aHasCurrent = a.player1Id === currentPlayerSocketId || a.player2Id === currentPlayerSocketId;
      const bHasCurrent = b.player1Id === currentPlayerSocketId || b.player2Id === currentPlayerSocketId;
      if (aHasCurrent && !bHasCurrent) return -1;
      if (bHasCurrent && !aHasCurrent) return 1;
      return 0;
    });
  }, [gameState.teams, currentPlayer?.socketId]);

  // Check if game can start
  const connectedNonHostPlayers = useMemo(
    () => gameState.players.filter(
      (p) => p.name !== gameState.host?.name && p.connected
    ),
    [gameState.players, gameState.host?.name]
  );

  const allPaired = useMemo(
    () =>
      connectedNonHostPlayers.length > 0 &&
      connectedNonHostPlayers.length === gameState.teams.length * 2,
    [connectedNonHostPlayers.length, gameState.teams.length]
  );

  const renderTeamCard = (team: Team) => {
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
        onUnpair={handleUnpair}
        onKick={handleKick}
      />
    );
  };

  const renderUnpairedPlayer = (player: Player) => {
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
        onPair={handlePair}
        onKick={handleKick}
      />
    );
  };

  return (
    <>
      {playerInfo.isHost && <DebugSidebar />}
      <ExitButton />
      <section className="section">
        <div className="container container-md">
          <div className="block">
            <h1 className="title has-text-centered">Lobby</h1>
            <p className="subtitle is-6 has-text-centered">
              Welcome to <strong>{gameState.host.name}</strong>'s game!
            </p>
          </div>

          <div className="notification is-info is-light has-text-centered">
            {playerCount} player{playerCount !== 1 ? 's' : ''} connected, {teamCount} team
            {teamCount !== 1 ? 's' : ''} formed
          </div>

          <div className="columns mb-5">
            <div className="column">
              <h2 className="subtitle is-5 mb-3">Singles</h2>
              {sortedUnpairedPlayers.length > 0 ? (
                sortedUnpairedPlayers.map(renderUnpairedPlayer)
              ) : (
                <p className="has-text-grey-light is-italic">No singles mingling</p>
              )}
            </div>
            <div className="column">
              <h2 className="subtitle is-5 mb-3">Couples</h2>
              {sortedTeams.length > 0 ? (
                sortedTeams.map(renderTeamCard)
              ) : (
                <p className="has-text-grey-light is-italic">No teams coupled up yet</p>
              )}
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
            </div>
          )}

          {error && <div className="notification is-danger is-light">{error}</div>}
        </div>
      </section>
    </>
  );
}
