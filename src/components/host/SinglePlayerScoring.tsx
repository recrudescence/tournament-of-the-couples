import { type Player, type CurrentRound } from '../../types/game';
import { PlayerAvatar } from '../common/PlayerAvatar';

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
            <div className="box has-background-white-ter">
              <div className="is-flex is-align-items-center mb-3" style={{ gap: '0.5rem' }}>
                <PlayerAvatar avatar={player.avatar} size="medium" />
                <span className="subtitle is-6 mb-0">{player.name} said...</span>
              </div>
              {!revealedAnswers.has(player.name) ? (
                <button
                  className="button is-link"
                  onClick={() => onRevealAnswer(player.name)}
                >
                  Reveal Answer
                </button>
              ) : (
                <div className="notification is-light">
                  <strong>{currentRound.answers[player.name]?.text || 'No answer'}</strong>
                  {revealedResponseTimes[player.name] !== undefined && (
                    <span className="has-text-grey ml-2">
                      (took {(revealedResponseTimes[player.name]! / 1000).toFixed(2)}s)
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
