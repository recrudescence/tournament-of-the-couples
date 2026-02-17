import {motion} from 'framer-motion';
import type {Player} from '../../types/game';
import {PlayerAvatar} from '../common/PlayerAvatar';
import {formatResponseTime} from '../../utils/formatUtils';
import {FlipCard} from './FlipCard';
import {buttonHover, buttonTap} from '../../styles/motion';

interface AnswerRevealCardProps {
  player: Player;
  label: string;
  answerText: string;
  revealKey: string;
  isRevealed: boolean;
  onReveal: (key: string) => void;
  responseTime?: number;
}

/**
 * A player answer card with avatar header and FlipCard reveal.
 * Used in both SinglePlayerScoring and BothPlayersScoring.
 */
export function AnswerRevealCard({
  player,
  label,
  answerText,
  revealKey,
  isRevealed,
  onReveal,
  responseTime,
}: AnswerRevealCardProps) {
  return (
    <>
      <div className="is-flex is-align-items-center mb-2" style={{ gap: '0.5rem', minHeight: '2.5em' }}>
        <PlayerAvatar avatar={player.avatar} size="small" />
        <span className="is-size-5 has-text-grey">{label}</span>
      </div>
      <FlipCard
        isRevealed={isRevealed}
        onReveal={() => onReveal(revealKey)}
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
          <div className="is-flex is-flex-direction-column is-justify-content-center is-align-items-center has-text-centered is-size-3" style={{ overflowWrap: 'break-word', wordBreak: 'break-word', whiteSpace: 'pre-wrap', height: '100%' }}>
            <p><strong>{answerText}</strong></p>
            {responseTime !== undefined && responseTime >= 0 && (
              <span className="has-text-grey is-size-5">
                (took {formatResponseTime(responseTime)})
              </span>
            )}
          </div>
        }
      />
    </>
  );
}
