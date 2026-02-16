import {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {type CurrentRound, type Player, type Team} from '../../types/game';
import {TeamName} from '../common/TeamName';
import {BothPlayersScoring} from './BothPlayersScoring';
import {SinglePlayerScoring} from './SinglePlayerScoring';
import {formatResponseTime} from '../../utils/formatUtils';
import {
  liftHover,
  liftTap,
  modalBackdrop,
  navArrowStyle,
  type NavDirection,
  popInSpin,
  scoringCardVariants,
  slideInLeft,
  slideInUpDeep,
  springBouncy,
  springDefault,
  springStiff,
} from '../../styles/motion';

interface PlayerWithTime {
  player: Player | undefined;
  time: number;
}

interface ScoringModalProps {
  team: Team;
  player1: Player | undefined;
  player2: Player | undefined;
  currentRound: CurrentRound;
  totalResponseTime: number;
  isFastestTeam: boolean;
  sortedPlayers: PlayerWithTime[];
  revealedAnswers: Set<string>;
  revealedResponseTimes: Record<string, number>;
  navDirection: NavDirection;
  hasPrev: boolean;
  hasNext: boolean;
  onRevealAnswer: (playerName: string) => void;
  onAwardPoints: (points: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function ScoringModal({
                               player1,
                               player2,
                               currentRound,
                               totalResponseTime,
                               isFastestTeam,
                               sortedPlayers,
                               revealedAnswers,
                               revealedResponseTimes,
                               navDirection,
                               hasPrev,
                               hasNext,
                               onRevealAnswer,
                               onAwardPoints,
                               onPrev,
                               onNext,
                               onClose
                             }: ScoringModalProps) {
  const [isExiting, setIsExiting] = useState(false);
  // Random tilt for playful entrance (only used when navDirection is null)
  const [initialTilt] = useState(() => ({
    rotateZ: (Math.random() - 0.5) * 8,
    rotateX: -20 + Math.random() * 10,
  }));

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onPrev();
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNext();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext]);

  const handleClose = () => {
    setIsExiting(true);
  };

  const handleAwardPoints = (points: number) => {
    setIsExiting(true);
    // Store points to pass after animation
    setTimeout(() => onAwardPoints(points), 250);
  };

  const handleExitComplete = () => {
    if (isExiting) {
      onClose();
    }
  };

  // Calculate if all answers are revealed for showing total time
  const allRevealed = (() => {
    if (!player1?.name || !player2?.name) return false;

    if (currentRound.answerForBoth) {
      return (
        revealedAnswers.has(`${player2.name}:${player1.name}`) &&
        revealedAnswers.has(`${player1.name}:${player1.name}`) &&
        revealedAnswers.has(`${player1.name}:${player2.name}`) &&
        revealedAnswers.has(`${player2.name}:${player2.name}`)
      );
    }
    return revealedAnswers.has(player1.name) && revealedAnswers.has(player2.name);
  })();

  const isNavigating = navDirection !== null;
  const cardVariants = scoringCardVariants(navDirection);

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {!isExiting && (
        <div className="modal is-active scoring-modal">
          {/* Backdrop */}
          <motion.div
            className="modal-background"
            variants={modalBackdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
            onClick={handleClose}
          />

          {/* Modal Card */}
          <motion.div
            className="modal-card modal-card-3d"
            style={{ position: 'relative', overflow: 'visible' }}
            custom={initialTilt}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={cardVariants}
            transition={springDefault}
          >
            {/* Nav arrows — positioned relative to modal card */}
            {hasPrev && (
              <motion.button
                style={{ ...navArrowStyle, left: -60 }}
                onClick={onPrev}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.15, background: 'rgba(255,255,255,1)', transition: springStiff }}
                whileTap={{ scale: 0.9, transition: springStiff }}
              >
                ‹
              </motion.button>
            )}
            {hasNext && (
              <motion.button
                style={{ ...navArrowStyle, right: -60 }}
                onClick={onNext}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.15, background: 'rgba(255,255,255,1)', transition: springStiff }}
                whileTap={{ scale: 0.9, transition: springStiff }}
              >
                ›
              </motion.button>
            )}

            <header className="modal-card-head" style={{ position: 'relative' }}>
              <motion.div
                className="modal-card-title is-flex is-align-items-center gap-sm is-size-3"
                variants={slideInLeft}
                initial={isNavigating ? false : 'hidden'}
                animate="visible"
                transition={{ ...springDefault, delay: isNavigating ? 0 : 0.15 }}
              >
                <TeamName player1={player1} player2={player2} size="large" />
              </motion.div>
              <AnimatePresence>
                {allRevealed && totalResponseTime < Infinity && (
                  <motion.span
                    className="tag is-secondary is-large mr-5"
                    style={{ transform: 'translateX(-50%)' }}
                    variants={popInSpin}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={springBouncy}
                  >
                    ⏱️ {formatResponseTime(totalResponseTime)}
                  </motion.span>
                )}
              </AnimatePresence>
              <button className="delete" aria-label="close" onClick={handleClose}></button>
            </header>

            <motion.section
              className="modal-card-body"
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
            >
              {currentRound.answerForBoth ? (
                <BothPlayersScoring
                  player1={player1}
                  player2={player2}
                  currentRound={currentRound}
                  revealedAnswers={revealedAnswers}
                  onRevealAnswer={onRevealAnswer}
                />
              ) : (
                <SinglePlayerScoring
                  sortedPlayers={sortedPlayers}
                  currentRound={currentRound}
                  revealedAnswers={revealedAnswers}
                  revealedResponseTimes={revealedResponseTimes}
                  onRevealAnswer={onRevealAnswer}
                />
              )}
            </motion.section>

            <footer className="modal-card-foot is-justify-content-center gap-sm">
              {[
                { points: 0, label: 'zero pts 😔', className: 'is-family-secondary' },
                { points: 1, label: 'one point ⭐', className: 'is-success' },
                ...(isFastestTeam
                  ? [{ points: 2, label: '🌟 two! ptz! 🌟', className: 'is-warning' }]
                  : []),
                ...(isFastestTeam && currentRound.answerForBoth
                  ? [{ points: 4, label: '🏆 FOUR!!! 🏆', className: 'is-danger' }]
                  : []),
              ].map(({ points, label, className }) => (
                <motion.button
                  key={points}
                  className={`button is-large ${className}`}
                  onClick={() => handleAwardPoints(points)}
                  variants={slideInUpDeep}
                  initial="hidden"
                  animate="visible"
                  transition={springStiff}
                  whileHover={liftHover}
                  whileTap={liftTap}
                >
                  {label}
                </motion.button>
              ))}
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
