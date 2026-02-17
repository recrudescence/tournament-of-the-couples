import {motion} from 'framer-motion';
import {type CurrentRound, type Player} from '../../types/game';
import {AnswerRevealCard} from './AnswerRevealCard';
import {slideInLeft, slideInRight, springDefault, staggerDelay} from '../../styles/motion';

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
            variants={index === 0 ? slideInLeft : slideInRight}
            initial="hidden"
            animate="visible"
            transition={{ ...springDefault, delay: staggerDelay(index) }}
          >
            <div className="box has-background-white-ter" style={{ borderRadius: '6px', padding: '0.75rem' }}>
              <AnswerRevealCard
                player={player}
                label={`${player.name} said...`}
                answerText={currentRound.answers[player.name]?.text || 'No answer'}
                revealKey={player.name}
                isRevealed={revealedAnswers.has(player.name)}
                onReveal={onRevealAnswer}
                responseTime={revealedResponseTimes[player.name]}
              />
            </div>
          </motion.div>
        ) : null
      )}
    </div>
  );
}
