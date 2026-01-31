import {Host} from "../../types/game.ts";
import {PlayerAvatar} from "../../components/common/PlayerAvatar.tsx";

interface WaitingStatusProps {
  host: Host;
  isInitialRound?: boolean;
}

export function WaitingStatus({ host, isInitialRound = false }: WaitingStatusProps) {
  if (isInitialRound) {
    return (
      <div className="box has-text-centered has-background-info-soft">
        <h2 className="subtitle is-4 mb-3">welcome to {host.name}'s game!</h2>
        <p className="has-text-grey mb-2">
          you'll answer questions on this device - response time matters.
        </p>
        <p className="has-text-grey">
          your host is setting up the first round now. be ready!
        </p>
      </div>
    );
  }

  return (
    <div className="box has-text-centered has-background-warning-soft">
      <div className="is-flex is-justify-content-center is-align-items-center mb-3" style={{ gap: '0.5rem' }}>
        <PlayerAvatar avatar={host.avatar} size="large" />
        <h2 className="subtitle is-4 mb-0">{host.name} is setting up the next round</h2>
      </div>
      <p className="has-text-grey">get ready to think heheh</p>
    </div>
  );
}
