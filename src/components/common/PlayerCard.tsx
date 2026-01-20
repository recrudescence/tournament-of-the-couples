import type { Player } from '../../types/game';

interface PlayerCardProps {
  player: Player;
  isCurrentPlayer: boolean;
  canPair: boolean;
  isHost: boolean;
  onPair: (socketId: string) => void;
  onKick: (socketId: string, playerName: string) => void;
}

export function PlayerCard({
  player,
  isCurrentPlayer,
  canPair,
  isHost,
  onPair,
  onKick
}: PlayerCardProps) {
  return (
    <div
      className={`box ${canPair ? 'is-clickable has-background-white-ter' : ''}`}
      onClick={canPair ? () => onPair(player.socketId) : undefined}
      style={canPair ? { cursor: 'pointer' } : {}}
    >
      <div className="is-flex is-justify-content-space-between is-align-items-center">
        <div className={`has-text-weight-semibold ${isCurrentPlayer ? 'has-text-primary' : ''}`}>
          {player.name}
          {isCurrentPlayer && ' (You)'}
        </div>
        {isHost && !isCurrentPlayer && (
          <button
            className="button is-small is-danger"
            onClick={(e) => {
              e.stopPropagation();
              onKick(player.socketId, player.name);
            }}
          >
            Kick
          </button>
        )}
      </div>
      {canPair && <div className="has-text-grey mt-2">Tap to pair</div>}
    </div>
  );
}
