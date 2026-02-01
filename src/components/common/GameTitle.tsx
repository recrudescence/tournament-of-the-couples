import {PlayerAvatar} from './PlayerAvatar';
import type {PlayerIdentity} from '../../types/game';

interface GameTitleProps {
  host?: PlayerIdentity;
  compact?: boolean;
}

export function GameTitle({ host, compact = false }: GameTitleProps) {
  if (compact) {
    return (
      <div
        className="is-flex is-align-items-center is-justify-content-center mb-4"
        style={{ gap: '0.5rem 0.75rem', flexWrap: 'wrap' }}
      >
        <h1 className="title game-title mb-0" style={{ fontSize: '1.75rem', whiteSpace: 'nowrap' }}>
          Tournament of the Couples
        </h1>
        {host && (
          <div
            className="is-inline-flex is-align-items-center"
            style={{
              gap: '0.3rem',
              padding: '0.2rem 0.5rem 0.2rem 0.3rem',
              borderRadius: '2rem',
              backgroundColor: 'var(--host-badge-bg, hsl(0, 0%, 96%))',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
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
