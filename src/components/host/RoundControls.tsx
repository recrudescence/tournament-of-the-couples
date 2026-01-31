import {useState} from 'react';
import type {Player} from '../../types/game';

interface RoundControlsProps {
  players: Player[];
  phase: 'roundSetup' | 'answering' | 'scoring';
  allAnswersIn: boolean;
  onKickPlayer: (socketId: string, playerName: string) => void;
  onReopenAnswering: () => void;
  onStartScoring: () => void;
  onResetGame: () => void;
  onEndGame: () => void;
}

export function RoundControls({
  players,
  phase,
  allAnswersIn,
  onKickPlayer,
  onReopenAnswering,
  onStartScoring,
  onResetGame,
  onEndGame
}: RoundControlsProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleKick = () => {
    const player = players.find(p => p.socketId === selectedPlayerId);
    if (player && window.confirm(`Are you sure you want to kick ${player.name}? They will be disconnected from the game.`)) {
      onKickPlayer(selectedPlayerId, player.name);
      setSelectedPlayerId('');
    }
  };

  const handleStartScoring = () => {
    if (!allAnswersIn) {
      if (window.confirm('Not all players have answered yet. Are you sure you want to begin scoring?')) {
        onStartScoring();
      }
    } else {
      onStartScoring();
    }
  };

  return (
    <div className="box has-background-light">
      <button
        className="button is-ghost is-fullwidth p-0 is-flex is-justify-content-space-between"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ height: 'auto' }}
      >
        <span className="has-text-weight-semibold">Host Controls</span>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="is-flex is-justify-content-space-between is-flex-wrap-wrap mt-3" style={{ gap: '0.5rem' }}>
          {/* Kick player form */}
          <div className="field has-addons mb-0">
            <div className="control">
              <div className="select is-small">
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                >
                  <option value="">Kick player...</option>
                  {players.map((player) => (
                    <option key={player.socketId} value={player.socketId}>
                      {player.name} {!player.connected ? '(dc)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="control">
              <button
                className="button is-danger is-small"
                onClick={handleKick}
                disabled={!selectedPlayerId}
              >
                Kick
              </button>
            </div>
          </div>

          {/* Skip to scoring (answering phase only) */}
          {phase === 'answering' && (
            <button
              className={`button is-small is-primary ${!allAnswersIn ? 'is-light' : ''}`}
              onClick={handleStartScoring}
            >
              Skip to Scoring
            </button>
          )}

          {/* Back to answering (scoring phase only) */}
          {phase === 'scoring' && (
            <button
              className="button is-small is-warning"
              onClick={onReopenAnswering}
            >
              Back to Answering
            </button>
          )}

          {/* Reset game button */}
          <button
            className="button is-family-secondary is-small"
            onClick={onResetGame}
          >
            Reset Game
          </button>

          {/* End game button */}
          <button
            className="button is-danger is-small"
            onClick={onEndGame}
          >
            End Game
          </button>
        </div>
      )}
    </div>
  );
}
