import {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {type CurrentRound, type Player, type Team} from '../../types/game';
import {TeamName} from '../common/TeamName';
import {BothPlayersScoring} from './BothPlayersScoring';
import {SinglePlayerScoring} from './SinglePlayerScoring';
import {formatResponseTime} from '../../utils/formatUtils';

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
  sortedPlayers: PlayerWithTime[];
  revealedAnswers: Set<string>;
  revealedResponseTimes: Record<string, number>;
  onRevealAnswer: (playerName: string) => void;
  onAwardPoints: (points: number) => void;
  onClose: () => void;
}

export function ScoringModal({
                               player1,
                               player2,
                               currentRound,
                               totalResponseTime,
                               sortedPlayers,
                               revealedAnswers,
                               revealedResponseTimes,
                               onRevealAnswer,
                               onAwardPoints,
                               onClose
                             }: ScoringModalProps) {
  const [isExiting, setIsExiting] = useState(false);
  // Random tilt for playful entrance
  const [initialTilt] = useState(() => ({
    rotateZ: (Math.random() - 0.5) * 8,
    rotateX: -20 + Math.random() * 10,
  }));

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

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
  // For answerForBoth: keys are "responder:subject" (e.g., "Bob:Alice", "Alice:Alice")
  // For single player: keys are just player names
  const allRevealed = (() => {
    if (!player1?.name || !player2?.name) return false;

    if (currentRound.answerForBoth) {
      // All 4 keys must be revealed
      return (
        revealedAnswers.has(`${player2.name}:${player1.name}`) &&
        revealedAnswers.has(`${player1.name}:${player1.name}`) &&
        revealedAnswers.has(`${player1.name}:${player2.name}`) &&
        revealedAnswers.has(`${player2.name}:${player2.name}`)
      );
    }
    return revealedAnswers.has(player1.name) && revealedAnswers.has(player2.name);
  })();

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {!isExiting && (
        <div className="modal is-active scoring-modal">
          {/* Backdrop */}
          <motion.div
            className="modal-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
          />

          {/* Modal Card - 3D flip entrance */}
          <motion.div
            className="modal-card"
            style={{ perspective: 1500, transformStyle: 'preserve-3d' }}
            initial={{
              scale: 0.3,
              rotateX: initialTilt.rotateX,
              rotateZ: initialTilt.rotateZ,
              y: -100,
              opacity: 0,
            }}
            animate={{
              scale: 1,
              rotateX: 0,
              rotateZ: 0,
              y: 0,
              opacity: 1,
            }}
            exit={{
              scale: 0.5,
              rotateX: 20,
              y: 100,
              opacity: 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 25,
            }}
          >
            <header className="modal-card-head" style={{ position: 'relative' }}>
              <motion.div
                className="modal-card-title is-flex is-align-items-center"
                style={{ gap: '0.5rem', fontSize: '2rem' }}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                <TeamName player1={player1} player2={player2} size="large" />
              </motion.div>
              <AnimatePresence>
                {allRevealed && totalResponseTime < Infinity && (
                  <motion.span
                    className="tag is-info is-large mr-5"
                    style={{ transform: 'translateX(-50%)' }}
                    initial={{ scale: 0, rotate: -180, y: -50 }}
                    animate={{ scale: 1, rotate: 0, y: 0 }}
                    exit={{ scale: 0, y: -30 }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 15,
                    }}
                  >
                    ⏱️ {formatResponseTime(totalResponseTime)}s
                  </motion.span>
                )}
              </AnimatePresence>
              <button className="delete" aria-label="close" onClick={handleClose}></button>
            </header>

            <motion.section
              className="modal-card-body"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
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

            <footer className="modal-card-foot is-justify-content-center" style={{ gap: '0.5rem' }}>
              {[
                { points: 0, label: 'zero pts 😔', className: 'is-family-secondary' },
                { points: 1, label: 'one point ⭐', className: 'is-success' },
                { points: 2, label: '🌟 two! ptz! 🌟', className: 'is-warning' },
              ].map(({ points, label, className }, index) => (
                <motion.button
                  key={points}
                  className={`button is-large ${className}`}
                  onClick={() => handleAwardPoints(points)}
                  initial={{ y: 50, opacity: 0, rotateX: -30 }}
                  animate={{ y: 0, opacity: 1, rotateX: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 20,
                    delay: 0.2 + index * 0.08,
                  }}
                  whileHover={{
                    scale: 1.08,
                    y: -4,
                    boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                  }}
                  whileTap={{
                    scale: 0.92,
                    y: 2,
                  }}
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
