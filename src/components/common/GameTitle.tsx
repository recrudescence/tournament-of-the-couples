import {PlayerAvatar} from './PlayerAvatar';
import type {PlayerIdentity} from '../../types/game';

interface GameTitleProps {
  host?: PlayerIdentity;
}

export function GameTitle({ host }: GameTitleProps) {
  return (
    <div className="has-text-centered mb-4">
      <h1 className="title game-title mb-2">
        Tournament of the Couples
      </h1>
      {host && (
        <div
          className="is-inline-flex is-align-items-center"
          style={{
            gap: '0.4rem',
            padding: '0.25rem 0.75rem 0.25rem 0.4rem',
            borderRadius: '2rem',
            backgroundColor: 'var(--host-badge-bg, hsl(0, 0%, 96%))',
            fontSize: '0.85rem',
          }}
        >
          {host.avatar && <PlayerAvatar avatar={host.avatar} size="small" />}
          <span className="has-text-grey">hosted by</span>
          <span className="has-text-weight-semibold">{host.name}</span>
        </div>
      )}
    </div>
  );
}
