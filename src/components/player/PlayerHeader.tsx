import { PlayerAvatar } from '../common/PlayerAvatar';
import { PlaceBadge } from '../common/PlaceBadge';
import type { PlayerIdentity } from '../../types/game';

interface PlayerHeaderProps {
  host: PlayerIdentity;
  player: PlayerIdentity;
  partner: PlayerIdentity;
  teamScore: number;
  teamPlace: number | null;
  isCelebrating: boolean;
}

export function PlayerHeader({
  host,
  player,
  partner,
  teamScore,
  teamPlace,
  isCelebrating
}: PlayerHeaderProps) {
  const showBadge = teamPlace !== null && teamPlace <= 3;

  return (
    <div className="box" style={{ overflow: 'visible' }}>
      <div className="columns is-mobile is-multiline has-text-centered">
        <div className="column is-half-mobile is-one-quarter-tablet">
          <p className="heading">Host</p>
          <div className="is-flex is-justify-content-center is-align-items-center" style={{ gap: '0.25rem' }}>
            {host.avatar && <PlayerAvatar avatar={host.avatar} size="small" />}
            <span className="title is-6">{host.name}</span>
          </div>
        </div>
        <div className="column is-half-mobile is-one-quarter-tablet">
          <p className="heading">You</p>
          <div className="is-flex is-justify-content-center is-align-items-center" style={{ gap: '0.25rem' }}>
            {player.avatar && <PlayerAvatar avatar={player.avatar} size="small" />}
            <span className="title is-6 has-text-primary mb-0">{player.name}</span>
          </div>
        </div>
        <div className="column is-half-mobile is-one-quarter-tablet">
          <p className="heading">Partner</p>
          <div className="is-flex is-justify-content-center is-align-items-center" style={{ gap: '0.25rem' }}>
            {partner.avatar && <PlayerAvatar avatar={partner.avatar} size="small" />}
            <span className="title is-6 mb-0">{partner.name}</span>
          </div>
        </div>
        <div className="column is-half-mobile is-one-quarter-tablet">
          <p className="heading">Team Score</p>
          <div className="is-flex is-justify-content-center is-align-items-center" style={{ minHeight: '2rem' }}>
            {showBadge ? (
              <PlaceBadge place={teamPlace} score={teamScore} size="small" />
            ) : (
              <p className={`title is-6 mb-0 ${isCelebrating ? 'has-text-success' : ''}`}>
                {teamPlace !== null ? `#${teamPlace} • ` : ''}{teamScore} pts
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
