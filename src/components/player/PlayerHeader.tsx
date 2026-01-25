import { PlayerAvatar } from '../common/PlayerAvatar';
import type { PlayerAvatar as PlayerAvatarType } from '../../types/game';

interface PlayerHeaderProps {
  hostName: string;
  playerName: string;
  playerAvatar: PlayerAvatarType | null;
  partnerName: string;
  partnerAvatar: PlayerAvatarType | null;
  teamScore: number;
  isCelebrating: boolean;
}

export function PlayerHeader({
  hostName,
  playerName,
  playerAvatar,
  partnerName,
  partnerAvatar,
  teamScore,
  isCelebrating
}: PlayerHeaderProps) {
  return (
    <div className="box">
      <div className="columns is-mobile is-multiline has-text-centered">
        <div className="column is-half-mobile is-one-quarter-tablet">
          <p className="heading">Host</p>
          <p className="title is-6">{hostName}</p>
        </div>
        <div className="column is-half-mobile is-one-quarter-tablet">
          <p className="heading">You</p>
          <div className="is-flex is-justify-content-center is-align-items-center" style={{ gap: '0.25rem' }}>
            {playerAvatar && <PlayerAvatar avatar={playerAvatar} size="small" />}
            <span className="title is-6 has-text-primary mb-0">{playerName}</span>
          </div>
        </div>
        <div className="column is-half-mobile is-one-quarter-tablet">
          <p className="heading">Partner</p>
          <div className="is-flex is-justify-content-center is-align-items-center" style={{ gap: '0.25rem' }}>
            {partnerAvatar && <PlayerAvatar avatar={partnerAvatar} size="small" />}
            <span className="title is-6 mb-0">{partnerName}</span>
          </div>
        </div>
        <div className="column is-half-mobile is-one-quarter-tablet">
          <p className="heading">Team Score</p>
          <p className={`title is-6 ${isCelebrating ? 'has-text-success' : ''}`}>
            {teamScore}
          </p>
        </div>
      </div>
    </div>
  );
}
