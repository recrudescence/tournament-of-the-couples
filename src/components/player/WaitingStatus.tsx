import {Host} from "../../types/game.ts";
import {PlayerAvatar} from "../../components/common/PlayerAvatar.tsx";

interface WaitingStatusProps {
  host: Host;
  isInitialRound?: boolean;
}

export function WaitingStatus({ host, isInitialRound = false }: WaitingStatusProps) {
  if (isInitialRound) {
    return (
      <div className="box has-text-centered has-background-info-light">
        <h2 className="title is-3 mb-3">welcome to {host.name}'s game~</h2>
        <p className="has-text-grey is-size-5 mb-2">
          you'll answer questions on this device - response time matters!
        </p>
        <p className="has-text-grey is-size-5">
          your host is setting up the first round now. be ready...
        </p>
      </div>
    );
  }

  return (
    <div className="box has-text-centered has-background-warning-light">
      <h2 className="subtitle is-3 mb-3">
        <span className="is-inline-flex is-align-items-center" style={{ gap: '0.35rem', verticalAlign: 'bottom' }}>
          <PlayerAvatar avatar={host.avatar} size="small" />
          <strong>{host.name}</strong>
        </span>
        {' '}is setting up the next round
      </h2>
      <p className="has-text-grey is-size-5">get ready to think heheh</p>
    </div>
  );
}
