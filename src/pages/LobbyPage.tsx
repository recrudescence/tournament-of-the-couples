import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import { useGameError } from '../hooks/useGameError';
import { useSnowEffect } from '../hooks/useConfetti';
import { DebugSidebar } from '../components/common/DebugSidebar';
import { ExitButton } from '../components/common/ExitButton';
import { PlayerCard } from '../components/common/PlayerCard';
import { TeamCard } from '../components/common/TeamCard';
import type { Player, Team } from '../types/game';

export function LobbyPage() {
  const navigate = useNavigate();
  const { emit, on } = useSocket();
  const { playerInfo, clearPlayerInfo } = usePlayerInfo();
  const { gameState, dispatch, myPlayer } = useGameContext();
  const { error, showError } = useGameError();

  // Add snow effect
  useSnowEffect();

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

      on('gameCancelled', ({ reason }) => {
        // Game was canceled (host left lobby) - clear info and redirect
        clearPlayerInfo();
        navigate('/');
        console.log('Game cancelled: ', reason);
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
        <div className="container" style={{ maxWidth: '800px' }}>
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

  const connectedPlayers = gameState.players.filter((p) => p.connected);
  const playerCount = connectedPlayers.length;
  const teamCount = gameState.teams.length;

  // Track rendered players to avoid duplicates
  const renderedPlayerIds = new Set<string>();

  // Check if game can start
  const connectedNonHostPlayers = gameState.players.filter(
    (p) => p.name !== gameState.host?.name && p.connected
  );
  const allPaired =
    connectedNonHostPlayers.length > 0 &&
    connectedNonHostPlayers.length === gameState.teams.length * 2;

  const renderTeamCard = (team: Team) => {
    const player1 = gameState.players.find((p) => p.socketId === team.player1Id);
    const player2 = gameState.players.find((p) => p.socketId === team.player2Id);

    if (!player1 || !player2) return null;

    renderedPlayerIds.add(player1.socketId);
    renderedPlayerIds.add(player2.socketId);

    const isCurrentPlayerInTeam =
      currentPlayer &&
      (player1.name === currentPlayer.name || player2.name === currentPlayer.name);

    const canUnpair = Boolean(isCurrentPlayerInTeam && !playerInfo.isHost);

    return (
      <TeamCard
        key={team.teamId}
        player1={player1}
        player2={player2}
        currentPlayerName={currentPlayer?.name || null}
        isHost={playerInfo.isHost}
        canUnpair={canUnpair}
        onUnpair={handleUnpair}
        onKick={handleKick}
      />
    );
  };

  const renderUnpairedPlayer = (player: Player) => {
    if (renderedPlayerIds.has(player.socketId)) return null;
    if (!player.connected) return null;

    const isCurrentPlayer = currentPlayer && player.name === currentPlayer.name;
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
        <div className="container" style={{ maxWidth: '800px' }}>
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

          <h2 className="subtitle is-4 mb-3">Players</h2>
          <div className="mb-5">
            {gameState.teams.map(renderTeamCard)}
            {gameState.players.map(renderUnpairedPlayer)}
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
