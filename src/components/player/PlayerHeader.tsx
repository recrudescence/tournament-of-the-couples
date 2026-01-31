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
    backgroundColor: isPlayer ? 'hsl(217, 71%, 95%)' : 'white',
    border: isPlayer ? '2px solid hsl(217, 71%, 53%)' : '2px solid hsl(0, 0%, 86%)',
    marginRight: side === 'left' ? '-0.25rem' : 0,
    marginLeft: side === 'right' ? '-0.25rem' : 0,
    position: 'relative' as const,
    zIndex: side === 'left' ? 1 : 2,
  });

  const mergeBlobStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '1.5rem',
    height: '2.5rem',
    background: 'linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,182,193,0.6) 50%, rgba(255,255,255,0.9) 100%)',
    borderRadius: '50%',
    zIndex: 0,
    filter: 'blur(2px)',
  };

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

        {/* Merge blob */}
        <div style={mergeBlobStyle} />

        {/* Partner - right bubble */}
        <div style={bubbleStyle(false, 'right')}>
          <span className="has-text-weight-semibold is-size-7">{partner.name}</span>
          {partner.avatar && <PlayerAvatar avatar={partner.avatar} size="medium" />}
        </div>
      </div>
    </div>
  );
}
