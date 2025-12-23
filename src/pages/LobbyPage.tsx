import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import { usePlayerInfo } from '../hooks/usePlayerInfo';
import { useGameContext } from '../context/GameContext';
import { useGameError } from '../hooks/useGameError';
import { DebugSidebar } from '../components/common/DebugSidebar';
import type { Player, Team } from '../types/game';
import '../styles/lobby.css';

export function LobbyPage() {
  const { emit, on } = useSocket();
  const { playerInfo } = usePlayerInfo();
  const { gameState, dispatch, myPlayer } = useGameContext();
  const { error, showError } = useGameError();

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

      on('error', ({ message }) => {
        showError(message);
      }),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [on, dispatch, showError]);

  const handlePair = (targetSocketId: string) => {
    emit('requestPair', { targetSocketId });
  };

  const handleUnpair = () => {
    emit('unpair');
  };

  const handleStartGame = () => {
    emit('startGame');
  };

  if (!playerInfo || !gameState) {
    return (
      <div className="container">
        <h1>Lobby</h1>
        <p>Loading...</p>
      </div>
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

    const canUnpair = isCurrentPlayerInTeam && !playerInfo.isHost;

    return (
      <div key={team.teamId} className="player-card paired">
        <div className={`player-name ${player1.name === currentPlayer?.name ? 'you' : ''}`}>
          {player1.name}
          {player1.name === currentPlayer?.name && ' (You)'}
          {!player1.connected && <span className="disconnected-label"> - Disconnected</span>}
        </div>
        <div className="partner-info">
          ↔ {player2.name}
          {player2.name === currentPlayer?.name && ' (You)'}
          {!player2.connected && <span className="disconnected-label"> - Disconnected</span>}
        </div>
        {canUnpair && (
          <button className="unpair-btn" onClick={handleUnpair}>
            Unpair
          </button>
        )}
      </div>
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
      <div
        key={player.socketId}
        className={`player-card ${canPair ? 'clickable' : ''}`}
        onClick={canPair ? () => handlePair(player.socketId) : undefined}
      >
        <div className={`player-name ${isCurrentPlayer ? 'you' : ''}`}>
          {player.name}
          {isCurrentPlayer && ' (You)'}
        </div>
        {canPair && <div className="partner-info">Click to pair</div>}
      </div>
    );
  };

  return (
    <>
      {playerInfo.isHost && <DebugSidebar />}
      <div className="container">
        <header>
          <h1>Lobby</h1>
          <div className="room-code-header">
            Welcome, hosted by <strong>{gameState.host.name}</strong>!
          </div>
        </header>

        <div className="info">
          {playerCount} player{playerCount !== 1 ? 's' : ''} connected, {teamCount} team
          {teamCount !== 1 ? 's' : ''} formed
        </div>

        <h2>Players</h2>
        <div id="playersList">
          {gameState.teams.map(renderTeamCard)}
          {gameState.players.map(renderUnpairedPlayer)}
        </div>

        {playerInfo.isHost && (
          <div className="host-controls">
            <button
              className="primary"
              onClick={handleStartGame}
              disabled={!allPaired}
            >
              Start Game
            </button>
            <p className="info host-message">
              {allPaired
                ? 'Ready to start!'
                : 'All connected players must be paired before starting the game.'}
            </p>
          </div>
        )}

        {error && <div className="error">{error}</div>}
      </div>
    </>
  );
}
