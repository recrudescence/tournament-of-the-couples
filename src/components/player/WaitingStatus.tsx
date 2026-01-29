import {Host} from "../../types/game.ts";
import {PlayerAvatar} from "../../components/common/PlayerAvatar.tsx";

interface WaitingStatusProps {
  host: Host;
}

export function WaitingStatus({ host }: WaitingStatusProps) {
  return (
    <div className="box has-text-centered has-background-warning-soft">
      <div className="is-flex is-justify-content-center is-align-items-center mb-3" style={{ gap: '0.5rem' }}>
        {host.avatar && <PlayerAvatar avatar={host.avatar} size="large" />}
        <h2 className="subtitle is-4 mb-0">{host.name} is setting up the next round</h2>
      </div>
      <p className="has-text-grey">get ready to think heheh</p>
    </div>
  );
}
