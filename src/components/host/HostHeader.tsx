import {PlayerAvatar} from "../../components/common/PlayerAvatar.tsx";
import {GameState} from "../../types/game.ts";

interface HostHeaderProps {
  gameState: GameState | null;
  gameStatus: String | null;
}

export function HostHeader({gameState, gameStatus
}: HostHeaderProps) {

  return (
    <div className="box">
      <div className="columns is-mobile has-text-centered">
        <div className="column">
          <p className="heading">Host</p>
          <div className="is-flex is-justify-content-center is-align-items-center" style={{ gap: '0.25rem' }}>
            <PlayerAvatar avatar={gameState?.host.avatar} size="small" />
            <span className="title is-6 has-text-primary mb-0">{gameState?.host.name}</span>
          </div>
        </div>
        <div className="column">
          <p className="heading">Round</p>
          <p className="title is-6">{gameState?.currentRound?.roundNumber || '-'}</p>
        </div>
        <div className="column">
          <p className="heading">Status</p>
          <p className="title is-6">{gameStatus}</p>
        </div>
      </div>
    </div>
  )
}