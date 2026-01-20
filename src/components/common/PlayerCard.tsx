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
      <div className="is-flex is-align-items-center" style={{ gap: '0.75rem' }}>
        <div
          className="is-flex is-align-items-center is-justify-content-center"
          style={{
            width: '3rem',
            height: '3rem',
            borderRadius: '50%',
            backgroundColor: player.avatar.color,
            fontSize: '1.5rem',
            flexShrink: 0,
          }}
        >
          {player.avatar.emoji}
        </div>
        <div className="is-flex-grow-1">
          <div className={`has-text-weight-semibold ${isCurrentPlayer ? 'has-text-primary' : ''}`}>
            {player.name}
            {isCurrentPlayer && ' (You)'}
          </div>
          {canPair && <div className="has-text-grey is-size-7">Tap to pair</div>}
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
    </div>
  );
}
