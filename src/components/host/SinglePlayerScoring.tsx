import {motion} from 'framer-motion';
import {type CurrentRound, type Player} from '../../types/game';
import {PlayerAvatar} from '../common/PlayerAvatar';
import {formatResponseTime} from '../../utils/formatUtils';
import {FlipCard} from './FlipCard';

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
      {sortedPlayers.map(({ player }, index) =>
        player ? (
          <motion.div
            key={player.socketId}
            className="column"
            initial={{ opacity: 0, x: index === 0 ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 25,
              delay: index * 0.1,
            }}
          >
            <div className="has-background-white-ter" style={{ borderRadius: '6px', padding: '0.75rem' }}>
              <div className="is-flex is-align-items-center mb-3" style={{ gap: '0.5rem' }}>
                <PlayerAvatar avatar={player.avatar} size="medium" />
                <span className="is-size-5 has-text-grey">{player.name} said...</span>
              </div>
              <FlipCard
                isRevealed={revealedAnswers.has(player.name)}
                onReveal={() => onRevealAnswer(player.name)}
                front={
                  <div className="has-text-centered">
                    <motion.button
                      className="button is-link is-medium"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Reveal Answer
                    </motion.button>
                  </div>
                }
                back={
                  <div className="notification is-light is-size-3 py-2 px-3 mb-0">
                    <p><strong>{currentRound.answers[player.name]?.text || 'No answer'}</strong></p>
                    {revealedResponseTimes[player.name] !== undefined && (
                      <span className="has-text-grey is-size-5">
                        (took {formatResponseTime(revealedResponseTimes[player.name]!, 2)} seconds)
                      </span>
                    )}
                  </div>
                }
              />
            </div>
          </motion.div>
        ) : null
      )}
    </div>
  );
}
