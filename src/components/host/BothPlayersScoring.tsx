import { motion } from 'framer-motion';
import type { CurrentRound, Player } from '../../types/game';
import { PlayerAvatar } from '../common/PlayerAvatar';
import { formatResponseTime } from '../../utils/formatUtils';
import { FlipCard } from './FlipCard';
import { slideInUp, slideInLeft, slideInRight, springDefault, staggerDelay, buttonHover, buttonTap } from '../../styles/motion';

// Helper to parse dual answer JSON
function parseDualAnswer(text: string): Record<string, string> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

interface BothPlayersScoringProps {
  player1: Player | undefined;
  player2: Player | undefined;
  currentRound: CurrentRound;
  revealedAnswers: Set<string>;
  onRevealAnswer: (key: string) => void;
}

/**
 * Scoring display for "both players" rounds where each player answers
 * for themselves AND their partner.
 *
 * Layout groups answers by player:
 * - Calvin
 *   - (partner's answer about Calvin)
 *   - (Calvin's answer about himself)
 * - Hannah
 *   - (partner's answer about Hannah)
 *   - (Hannah's answer about herself)
 */
export function BothPlayersScoring({
  player1,
  player2,
  currentRound,
  revealedAnswers,
  onRevealAnswer
}: BothPlayersScoringProps) {
  if (!player1 || !player2) return null;

  const player1Answer = currentRound.answers[player1.name];
  const player2Answer = currentRound.answers[player2.name];

  // Parse JSON answers: { [playerName]: answerText }
  const player1Parsed = player1Answer ? parseDualAnswer(player1Answer.text) : null;
  const player2Parsed = player2Answer ? parseDualAnswer(player2Answer.text) : null;

  // Each player section shows:
  // 1. What their partner said about them
  // 2. What they said about themselves
  const playerSections = [
    {
      subject: player1,
      partner: player2,
      // Partner's answer about this player
      partnerAnswerKey: `${player2.name}:${player1.name}`,
      partnerAnswerText: player2Parsed?.[player1.name] ?? '(no answer)',
      // Player's own answer about themselves
      selfAnswerKey: `${player1.name}:${player1.name}`,
      selfAnswerText: player1Parsed?.[player1.name] ?? '(no answer)',
    },
    {
      subject: player2,
      partner: player1,
      partnerAnswerKey: `${player1.name}:${player2.name}`,
      partnerAnswerText: player1Parsed?.[player2.name] ?? '(no answer)',
      selfAnswerKey: `${player2.name}:${player2.name}`,
      selfAnswerText: player2Parsed?.[player2.name] ?? '(no answer)',
    },
  ];

  return (
    <div className="both-players-scoring">
      {playerSections.map(({ subject, partner, partnerAnswerKey, partnerAnswerText, selfAnswerKey, selfAnswerText }, sectionIndex) => {
        const partnerRevealed = revealedAnswers.has(partnerAnswerKey);
        const selfRevealed = revealedAnswers.has(selfAnswerKey);
        const partnerResponseTime = currentRound.answers[partner.name]?.responseTime;
        const baseDelay = staggerDelay(sectionIndex, 0, 0.15);

        return (
          <motion.div
            key={subject.socketId}
            className="box has-background-white-ter mb-3"
            variants={slideInUp}
            initial="hidden"
            animate="visible"
            transition={{ ...springDefault, delay: baseDelay }}
          >
            {/* Player header */}
            <div className="is-flex is-align-items-center mb-3" style={{ gap: '0.5rem', fontSize: '1.5rem' }}>
              Answers about
              <PlayerAvatar avatar={subject.avatar} size="medium" />
              <span className="subtitle is-4 mb-0">{subject.name}</span>
            </div>

            {/* Two answer cards side by side */}
            <div className="columns is-mobile">
              {/* Partner's answer about this player */}
              <motion.div
                className="column"
                variants={slideInLeft}
                initial="hidden"
                animate="visible"
                transition={{ ...springDefault, delay: baseDelay + 0.1 }}
              >
                <div className="is-flex is-align-items-center mb-2" style={{ gap: '0.25rem' }}>
                  <PlayerAvatar avatar={partner.avatar} size="small" />
                  <span className="is-size-5 has-text-grey">{partner.name} said that {subject.name} would write...</span>
                </div>
                <FlipCard
                  isRevealed={partnerRevealed}
                  onReveal={() => onRevealAnswer(partnerAnswerKey)}
                  front={
                    <div className="has-text-centered">
                      <motion.button
                        className="button is-link is-medium"
                        whileHover={buttonHover}
                        whileTap={buttonTap}
                      >
                        Reveal
                      </motion.button>
                    </div>
                  }
                  back={
                    <div className="notification is-light is-size-3 py-2 px-3 mb-0">
                      <strong>{partnerAnswerText}</strong>
                      {partnerResponseTime !== undefined && partnerResponseTime >= 0 && (
                        <span className="has-text-grey ml-2 is-size-5">
                          (took {formatResponseTime(partnerResponseTime)} seconds)
                        </span>
                      )}
                    </div>
                  }
                />
              </motion.div>

              {/* Player's own answer about themselves */}
              <motion.div
                className="column"
                variants={slideInRight}
                initial="hidden"
                animate="visible"
                transition={{ ...springDefault, delay: baseDelay + 0.15 }}
              >
                <div className="is-flex is-align-items-center mb-2" style={{ gap: '0.25rem' }}>
                  <PlayerAvatar avatar={subject.avatar} size="small" />
                  <span className="is-size-5 has-text-grey">{subject.name} actually said...</span>
                </div>
                <FlipCard
                  isRevealed={selfRevealed}
                  onReveal={() => onRevealAnswer(selfAnswerKey)}
                  front={
                    <div className="has-text-centered">
                      <motion.button
                        className="button is-link is-medium"
                        whileHover={buttonHover}
                        whileTap={buttonTap}
                      >
                        Reveal
                      </motion.button>
                    </div>
                  }
                  back={
                    <div className="notification is-light is-size-3 py-2 px-3 mb-0">
                      <strong>{selfAnswerText}</strong>
                    </div>
                  }
                />
              </motion.div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
