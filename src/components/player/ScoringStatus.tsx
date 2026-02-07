import {useEffect, useRef} from 'react';
import {motion} from 'framer-motion';
import confetti from 'canvas-confetti';
import {ScoreDisplay} from '../common/ScoreDisplay';
import {scalePop, springBouncy} from '../../styles/motion';

interface ScoringStatusProps {
  pointsAwarded?: number | null;
}

function firePointsCelebration(points: number) {
  const colors = points === 2 ? ['#ff9c29', '#ff4c4c', '#FFD700'] : ['#48c774', '#3ec46d', '#00d1b2'];

  // Fire from both sides
  confetti({
    particleCount: 40 + (points * 20),
    startVelocity: 35,
    spread: 80,
    angle: 60,
    origin: { x: 0.1, y: 0.6 },
    colors,
    ticks: 120,
    gravity: 0.8,
    scalar: 1.2
  });
  confetti({
    particleCount: 40 + (points * 20),
    startVelocity: 35,
    spread: 80,
    angle: 120,
    origin: { x: 0.9, y: 0.6 },
    colors,
    ticks: 120,
    gravity: 0.8,
    scalar: 1.2
  });
}

// Sadder, slower entrance for no points
const noPointsVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function ScoringStatus({ pointsAwarded }: ScoringStatusProps) {
  const hasTriggeredConfetti = useRef(false);

  // Fire confetti when points are awarded (only once per mount)
  useEffect(() => {
    if (pointsAwarded && pointsAwarded > 0 && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      // Small delay to let the animation start first
      setTimeout(() => firePointsCelebration(pointsAwarded), 150);
    }
  }, [pointsAwarded]);

  // Reset confetti flag when going back to waiting state
  useEffect(() => {
    if (pointsAwarded === null || pointsAwarded === undefined) {
      hasTriggeredConfetti.current = false;
    }
  }, [pointsAwarded]);

  // Scored with points
  if (pointsAwarded !== null && pointsAwarded !== undefined && pointsAwarded > 0) {
    return (
      <motion.div
        className="box has-text-centered"
        variants={scalePop}
        initial="hidden"
        animate="visible"
        transition={springBouncy}
        style={{ backgroundColor: 'color-mix(in srgb, var(--theme-success) 12%, var(--theme-bg))' }}
      >
        <motion.h2
          className="title is-3 has-text-success mb-3"
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...springBouncy, delay: 0.1 }}
        >
          o nice you got points! 🎉
        </motion.h2>
        <motion.p
          className="subtitle is-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ScoreDisplay
            score={pointsAwarded}
            size="large"
            showDelta
            suffix={pointsAwarded === 1 ? 'point' : 'points'}
            highlighted
          />
          {' '}received that round
        </motion.p>
      </motion.div>
    );
  }

  // Scored with zero points
  if (pointsAwarded === 0) {
    return (
      <motion.div
        className="box has-text-centered"
        variants={noPointsVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <motion.h2
          className="title is-4 has-text-grey mb-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          no points this round
        </motion.h2>
        <motion.p
          className="subtitle is-5 has-text-grey"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          dang 😔
        </motion.p>
      </motion.div>
    );
  }

  // Default: waiting for host to score
  return (
    <div
      className="box has-text-centered"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--theme-success) 15%, var(--theme-bg))',
        color: 'var(--theme-text-body)'
      }}
    >
      <h2 className="subtitle is-4 mb-3" style={{ color: 'var(--theme-success)' }}>All answers are in!</h2>
      <p>The host is reviewing answers and awarding points on the big screen. Look that way!</p>
    </div>
  );
}
