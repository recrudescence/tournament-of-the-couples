import type { Player } from '../../types/game';

interface TeamCardProps {
  player1: Player;
  player2: Player;
  currentPlayerName: string | null;
  isHost: boolean;
  canUnpair: boolean;
  onUnpair: () => void;
  onKick: (socketId: string, playerName: string) => void;
}

export function TeamCard({
  player1,
  player2,
  currentPlayerName,
  isHost,
  canUnpair,
  onUnpair,
  onKick
}: TeamCardProps) {
  const isPlayer1Current = player1.name === currentPlayerName;

  // Show current player on the left
  const [leftPlayer, rightPlayer] = (isPlayer1Current || isHost)
    ? [player1, player2]
    : [player2, player1];

  const renderPlayerMiniCard = (player: Player) => {
    const isCurrent = player.name === currentPlayerName;
    return (
      <div className="box mb-0 p-3" style={{ flex: '1 1 0', minWidth: 0 }}>
        <div className={`has-text-weight-semibold ${isCurrent ? 'has-text-primary' : ''}`}>
          {player.name}
          {isCurrent && <span className="has-text-grey-light"> (you)</span>}
        </div>
        {isHost && (
          <button
            className="button is-small is-danger mt-2"
            onClick={() => onKick(player.socketId, player.name)}
          >
            Kick
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="box has-background-link-light">
      <div className="is-flex is-align-items-center" style={{ gap: '0.5rem' }}>
        {renderPlayerMiniCard(leftPlayer)}
        <span className="is-size-4">🤝🏼</span>
        {renderPlayerMiniCard(rightPlayer)}
      </div>
      {canUnpair && (
        <div className="mt-3">
          <button className="button is-small is-danger is-light" onClick={onUnpair}>
            Break up
          </button>
        </div>
      )}
    </div>
  );
}
