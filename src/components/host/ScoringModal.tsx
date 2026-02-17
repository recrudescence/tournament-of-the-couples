import {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {type CurrentRound, type Player, type Team} from '../../types/game';
import {TeamName} from '../common/TeamName';
import {BothPlayersScoring} from './BothPlayersScoring';
import {SinglePlayerScoring} from './SinglePlayerScoring';
import {formatResponseTime} from '../../utils/formatUtils';
import {fireScoringBurst} from '../../hooks/useConfetti';
import {
  buttonHover,
  buttonTap,
  liftHover,
  liftTap,
  modalBackdrop,
  type NavDirection,
  popInSpin,
  scoringCardVariants,
  slideInLeft,
  slideInUpDeep,
  springDefault,
  springGentle,
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
  isScored: boolean;
  scoredPoints: number;
  sortedPlayers: PlayerWithTime[];
  revealedAnswers: Set<string>;
  revealedResponseTimes: Record<string, number>;
  navDirection: NavDirection;
  hasPrev: boolean;
  hasNext: boolean;
  onRevealAnswer: (playerName: string) => void;
  onAwardPoints: (points: number) => void;
  onRescore: () => void;
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
                               isScored,
                               scoredPoints,
                               sortedPlayers,
                               revealedAnswers,
                               revealedResponseTimes,
                               navDirection,
                               hasPrev,
                               hasNext,
                               onRevealAnswer,
                               onAwardPoints,
                               onRescore,
                               onPrev,
                               onNext,
                               onClose
                             }: ScoringModalProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [showPointButtons, setShowPointButtons] = useState(!isScored);
  const [awardedPoints, setAwardedPoints] = useState<number | null>(isScored ? scoredPoints : null);
  const footerRef = useRef<HTMLElement>(null);
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
    onAwardPoints(points);
    setAwardedPoints(points);
    setShowPointButtons(false);

    // Fire confetti from footer area (only for points > 0)
    if (points > 0 && footerRef.current) {
      const rect = footerRef.current.getBoundingClientRect();
      const originX = (rect.left + rect.width / 2) / window.innerWidth;
      const originY = rect.top / window.innerHeight;
      fireScoringBurst(originX, originY, points);
    }
  };

  const handleRescore = () => {
    onRescore();
    setAwardedPoints(null);
    setShowPointButtons(true);
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
            style={{ position: 'relative', overflow: 'visible', minHeight: '60%' }}
            custom={initialTilt}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={cardVariants}
            transition={springGentle}
          >
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
                    variants={popInSpin}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={springStiff}
                  >
                    ⏱️ {formatResponseTime(totalResponseTime)}
                  </motion.span>
                )}
                {awardedPoints !== null && (
                  <motion.span
                    className={`tag is-large ${awardedPoints > 0 ? 'is-success' : 'is-light'} mr-5`}
                    variants={popInSpin}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={springStiff}
                  >
                    {awardedPoints > 0 ? `+${awardedPoints} pts` : '0 pts'}
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

            <footer ref={footerRef} className="modal-card-foot" style={{ flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem' }}>
              {/* Prev */}
              <motion.button
                className="button is-medium"
                onClick={onPrev}
                disabled={!hasPrev}
                style={{ visibility: hasPrev ? 'visible' : 'hidden' }}
                whileHover={buttonHover}
                whileTap={buttonTap}
              >
                ← Prev
              </motion.button>

              {/* Center: point buttons or re-score */}
              <AnimatePresence mode="wait">
                {showPointButtons ? (
                  <motion.div
                    key="point-buttons"
                    className="is-flex is-justify-content-center gap-sm"
                    style={{ flexWrap: 'wrap' }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={springStiff}
                  >
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
                        className={`button is-medium ${className}`}
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
                  </motion.div>
                ) : (
                  <motion.div
                    key="rescore-button"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={springStiff}
                  >
                    <motion.button
                      className="button is-medium is-light"
                      onClick={handleRescore}
                      whileHover={buttonHover}
                      whileTap={buttonTap}
                    >
                      Re-score
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Next */}
              <motion.button
                className="button is-medium is-primary"
                onClick={hasNext ? onNext : handleClose}
                style={{ visibility: hasNext ? 'visible' : 'hidden' }}
                whileHover={buttonHover}
                whileTap={buttonTap}
              >
                Next →
              </motion.button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
