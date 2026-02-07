import { useEffect } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { usePrevious } from '../../hooks/usePrevious';
import { scorePulse, scorePulseTransition } from '../../styles/motion';

type ScoreSize = 'small' | 'medium' | 'large' | 'xlarge';
type ScoreColor = 'auto' | 'inherit' | 'white' | 'muted';

interface ScoreDisplayProps {
  score: number;
  size?: ScoreSize;
  /** If true, shows as "+N" instead of "N" */
  showDelta?: boolean;
  /** Custom suffix - defaults to "pts" for small/medium, "points" for large */
  suffix?: string;
  /** Additional className */
  className?: string;
  /** Whether this is a highlighted/winner score (bolder, uses primary color) */
  highlighted?: boolean;
  /** Color mode: 'auto' uses highlighted logic, 'inherit' uses parent color */
  color?: ScoreColor;
}

const sizeClasses: Record<ScoreSize, string> = {
  small: 'is-size-7',
  medium: 'is-size-6',
  large: 'is-size-5',
  xlarge: 'is-size-4',
};

function getColorClass(color: ScoreColor, highlighted: boolean): string {
  switch (color) {
    case 'inherit': return '';
    case 'white': return 'has-text-white';
    case 'muted': return 'has-text-grey';
    case 'auto':
    default:
      return highlighted ? 'has-text-link' : 'has-text-grey-dark';
  }
}

export function ScoreDisplay({
  score,
  size = 'medium',
  showDelta = false,
  suffix,
  className = '',
  highlighted = false,
  color = 'auto',
}: ScoreDisplayProps) {
  const controls = useAnimationControls();
  const prevScore = usePrevious(score);

  // Determine suffix based on size if not provided
  const displaySuffix = suffix ?? (size === 'large' || size === 'xlarge' ? 'points' : 'pts');

  // Format: "5 pts" or "+2 points"
  const displayValue = showDelta ? `+${score}` : score;
  const displayText = `${displayValue} ${displaySuffix}`;

  // Trigger pulse animation when score increases
  useEffect(() => {
    if (prevScore !== undefined && prevScore !== score && score > prevScore) {
      controls.start(scorePulse, scorePulseTransition);
    }
  }, [score, prevScore, controls]);

  return (
    <motion.span
      animate={controls}
      className={`${sizeClasses[size]} ${getColorClass(color, highlighted)} ${highlighted ? 'has-text-weight-bold' : 'has-text-weight-semibold'} ${className}`}
      style={{ transformOrigin: 'center', display: 'inline-block' }}
    >
      {displayText}
    </motion.span>
  );
}
