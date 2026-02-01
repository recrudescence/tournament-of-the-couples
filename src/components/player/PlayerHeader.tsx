import {PlayerAvatar} from '../common/PlayerAvatar';
import type {PlayerIdentity} from '../../types/game';

interface PlayerHeaderProps {
  player: PlayerIdentity;
  partner: PlayerIdentity;
}

export function PlayerHeader({ player, partner }: PlayerHeaderProps) {
  const bubbleStyle = (isPlayer: boolean, side: 'left' | 'right'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: side === 'left' ? '0.5rem 0.75rem 0.5rem 0.5rem' : '0.5rem 0.5rem 0.5rem 0.75rem',
    borderRadius: '2rem',
    backgroundColor: isPlayer ? 'var(--player-bubble-bg, hsl(217, 71%, 95%))' : 'var(--partner-bubble-bg, white)',
    border: isPlayer ? '2px solid var(--theme-primary)' : '2px solid var(--partner-bubble-border, hsl(0, 0%, 86%))',
    marginRight: side === 'left' ? '-0.25rem' : 0,
    marginLeft: side === 'right' ? '-0.25rem' : 0,
    position: 'relative' as const,
    zIndex: side === 'left' ? 1 : 2,
  });

  return (
    <div className="has-text-centered">
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        {/* Player (you) - left bubble */}
        <div style={bubbleStyle(true, 'left')}>
          {player.avatar && <PlayerAvatar avatar={player.avatar} size="medium" />}
          <span className="has-text-weight-semibold is-size-7 has-text-primary">
            {player.name}
            <span className="has-text-grey-light"> (you)</span>
          </span>
        </div>

        {/* Partner - right bubble */}
        <div style={bubbleStyle(false, 'right')}>
          <span className="has-text-weight-semibold is-size-7">{partner.name}</span>
          {partner.avatar && <PlayerAvatar avatar={partner.avatar} size="medium" />}
        </div>
      </div>
    </div>
  );
}
