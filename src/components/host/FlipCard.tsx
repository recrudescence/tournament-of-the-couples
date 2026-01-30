import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { flipCard, springDefault } from '../../styles/motion';

interface FlipCardProps {
  isRevealed: boolean;
  onReveal: () => void;
  front: ReactNode;
  back: ReactNode;
  minHeight?: string;
}

/**
 * A 3D flip card component for revealing answers.
 * Shows `front` content (typically a reveal button) until revealed,
 * then flips to show `back` content (the answer).
 */
export function FlipCard({
  isRevealed,
  onReveal,
  front,
  back,
  minHeight = '10rem',
}: FlipCardProps) {
  return (
    <div style={{ perspective: 1000, minHeight }}>
      <motion.div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight,
          transformStyle: 'preserve-3d',
        }}
        variants={flipCard}
        initial={false}
        animate={isRevealed ? 'back' : 'front'}
        transition={springDefault}
      >
        {/* Front face - Reveal button */}
        <div
          className="box"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            minHeight,
            backfaceVisibility: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: !isRevealed ? 'pointer' : undefined,
          }}
          onClick={!isRevealed ? onReveal : undefined}
        >
          {front}
        </div>

        {/* Back face - Answer content */}
        <div
          className="box"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            minHeight,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
}
