import { PlayerAvatar } from './PlayerAvatar';
import type { Player } from '../../types/game';

interface TeamNameProps {
  player1: Player | undefined;
  player2: Player | undefined;
  size?: 'small' | 'medium' | 'large';
}

export function TeamName({ player1, player2, size = 'small' }: TeamNameProps) {
  return (
    <div className="is-flex is-align-items-center" style={{ gap: '1rem' }}>
      <div className="is-flex" style={{ marginRight: '-0.5rem' }}>
        {player1 && (
          <div style={{ zIndex: 2 }}>
            <PlayerAvatar avatar={player1.avatar} size={size} />
          </div>
        )}
        {player2 && (
          <div style={{ marginLeft: '-0.5rem', zIndex: 1 }}>
            <PlayerAvatar avatar={player2.avatar} size={size} />
          </div>
        )}
      </div>
      <span className="has-text-weight-bold">
        {player1?.name ?? '?'} & {player2?.name ?? '?'}
      </span>
    </div>
  );
}
