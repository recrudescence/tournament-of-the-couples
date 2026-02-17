import type {Player} from '../../types/game';
import {PlayerAvatar} from './PlayerAvatar';

type PillSize = 'small' | 'normal' | 'large';

interface PlayerPillProps {
  player: Player;
  size?: PillSize;
  highlight?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function pillStyle(options: { size?: PillSize; highlight?: boolean } = {}): React.CSSProperties {
  const { size = 'normal', highlight = false } = options;
  const isLarge = size === 'large';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: isLarge ? '0.75rem' : '0.5rem',
    padding: isLarge ? '0.75rem 1.25rem 0.75rem 0.75rem' : '0.5rem 1rem 0.5rem 0.5rem',
    borderRadius: '2rem',
    backgroundColor: highlight ? 'var(--player-bubble-bg, hsl(217, 71%, 95%))' : 'var(--partner-bubble-bg, white)',
    border: highlight ? '2px solid var(--theme-primary, hsl(217, 71%, 53%))' : '2px solid var(--partner-bubble-border, transparent)',
    fontSize: isLarge ? '1.1rem' : undefined,
  };
}

export function PlayerPill({
  player,
  size = 'normal',
  highlight = false,
  className,
  style,
}: PlayerPillProps) {
  return (
    <div className={className} style={{ ...pillStyle({ size, highlight }), ...style }}>
      <PlayerAvatar avatar={player.avatar} size={size === 'large' ? 'large' : 'medium'} />
      <span className="has-text-weight-semibold">{player.name}</span>
    </div>
  );
}
