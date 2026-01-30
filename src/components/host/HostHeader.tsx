import {PlayerAvatar} from "../../components/common/PlayerAvatar.tsx";
import type {PlayerAvatar as PlayerAvatarType} from "../../types/game.ts";

interface HostHeaderProps {
  hostName: string;
  hostAvatar?: PlayerAvatarType | null;
  roundNumber: number;
  gameStatus: string;
}

export function HostHeader({hostName, hostAvatar, roundNumber, gameStatus}: HostHeaderProps) {
  return (
    <div className="box">
      <div className="columns is-mobile has-text-centered">
        <div className="column">
          <p className="heading">Host</p>
          <div className="is-flex is-justify-content-center is-align-items-center" style={{ gap: '0.25rem' }}>
            <PlayerAvatar avatar={hostAvatar} size="small" />
            <span className="title is-6 has-text-primary mb-0">{hostName}</span>
          </div>
        </div>
        <div className="column">
          <p className="heading">Round</p>
          <p className="title is-6">{roundNumber}</p>
        </div>
        <div className="column">
          <p className="heading">Status</p>
          <p className="title is-6">{gameStatus}</p>
        </div>
      </div>
    </div>
  );
}