import { type Player, type CurrentRound } from '../../types/game';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { formatResponseTime } from '../../utils/formatUtils';

interface PlayerWithTime {
  player: Player | undefined;
  time: number;
}

interface SinglePlayerScoringProps {
  sortedPlayers: PlayerWithTime[];
  currentRound: CurrentRound;
  revealedAnswers: Set<string>;
  revealedResponseTimes: Record<string, number>;
  onRevealAnswer: (playerName: string) => void;
}

/**
 * Scoring display for standard rounds where each player answers only for themselves.
 * Shows each player's answer side by side, sorted by response time.
 */
export function SinglePlayerScoring({
  sortedPlayers,
  currentRound,
  revealedAnswers,
  revealedResponseTimes,
  onRevealAnswer
}: SinglePlayerScoringProps) {
  return (
    <div className="columns">
      {sortedPlayers.map(({ player }) =>
        player ? (
          <div key={player.socketId} className="column">
            <div className="box has-background-white-ter" style={{ minHeight: '10rem' }}>
              <div className="is-flex is-align-items-center mb-3" style={{ gap: '0.5rem' }}>
                <PlayerAvatar avatar={player.avatar} size="medium" />
                <span className="is-size-5 has-text-grey">{player.name} said...</span>
              </div>
              {!revealedAnswers.has(player.name) ? (
                <div className="has-text-centered">
                  <button
                    className="button is-link is-medium"
                    onClick={() => onRevealAnswer(player.name)}
                  >
                    Reveal Answer
                  </button>
                </div>
              ) : (
                <div className="notification is-light is-size-3 py-2 px-3">
                  <p><strong>{currentRound.answers[player.name]?.text || 'No answer'}</strong></p>
                  {revealedResponseTimes[player.name] !== undefined && (
                    <span className="has-text-grey is-size-5">
                      (took {formatResponseTime(revealedResponseTimes[player.name]!, 2)} seconds)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
