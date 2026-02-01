import { motion } from 'framer-motion';
import {
  springBouncy,
  badgeEntrance,
  badgeFloat,
  badgeFloatTransition,
  badgeShimmer,
  badgeShimmerTransition,
  badgeVibrate,
  badgeVibrateTransition,
  badgeShadowKeyframes,
} from '../../styles/motion';

interface PlaceBadgeProps {
  place: number;
  score?: number;
  size?: 'small' | 'medium' | 'large';
}

const placeConfig = {
  1: {
    emoji: '🥇',
    label: '1st',
    bgGradient: 'linear-gradient(135deg, #ffd700 0%, #ffec80 50%, #ffd700 100%)',
    shadowColor: 'rgba(255, 215, 0, 0.6)',
    textColor: '#8B6914',
  },
  2: {
    emoji: '🥈',
    label: '2nd',
    bgGradient: 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 50%, #c0c0c0 100%)',
    shadowColor: 'rgba(192, 192, 192, 0.6)',
    textColor: '#5a5a5a',
  },
  3: {
    emoji: '🥉',
    label: '3rd',
    bgGradient: 'linear-gradient(135deg, #cd7f32 0%, #daa06d 50%, #cd7f32 100%)',
    shadowColor: 'rgba(205, 127, 50, 0.5)',
    textColor: '#5c3a21',
  },
} as const;

const sizeStyles = {
  small: { fontSize: '0.85rem', padding: '0.25rem 0.5rem', emojiSize: '1rem' },
  medium: { fontSize: '1rem', padding: '0.35rem 0.75rem', emojiSize: '1.25rem' },
  large: { fontSize: '1.25rem', padding: '0.5rem 1rem', emojiSize: '1.5rem' },
};

/**
 * Animated place badge for 1st, 2nd, 3rd place teams.
 * - 1st place: Gold with shine + vibrate
 * - 2nd place: Silver with shine
 * - 3rd place: Bronze with subtle glow
 * - Others: Simple text display
 */
export function PlaceBadge({ place, score, size = 'medium' }: PlaceBadgeProps) {
  const config = placeConfig[place as keyof typeof placeConfig];
  const sizeStyle = sizeStyles[size];

  // For places 4+, show simple text
  if (!config) {
    return (
      <span className="has-text-weight-bold is-size-5" style={{ color: 'var(--theme-text-muted)' }}>
        #{place}
        {score !== undefined && <span className="ml-2" style={{ color: 'var(--theme-text-muted)' }}>{score} pts</span>}
      </span>
    );
  }

  const isFirst = place === 1;
  const isSecond = place === 2;

  return (
    <motion.div
      style={{
        position: 'relative',
        zIndex: 4 - place, // 1st = z-3, 2nd = z-2, 3rd = z-1
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
      }}
      variants={badgeEntrance}
      initial="hidden"
      animate="visible"
      transition={springBouncy}
    >
      {/* Floating badge container */}
      <motion.div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          background: config.bgGradient,
          backgroundSize: '200% 200%',
          padding: sizeStyle.padding,
          borderRadius: '999px',
          boxShadow: `0 4px 12px ${config.shadowColor}, inset 0 1px 2px rgba(255,255,255,0.4)`,
          color: config.textColor,
          fontWeight: 700,
          fontSize: sizeStyle.fontSize,
        }}
        animate={{
          ...badgeFloat,
          boxShadow: badgeShadowKeyframes(config.shadowColor),
        }}
        transition={badgeFloatTransition}
      >
        {/* Shimmer overlay for gold/silver */}
        {(isFirst || isSecond) && (
          <motion.div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: '999px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              pointerEvents: 'none',
            }}
            animate={badgeShimmer}
            transition={badgeShimmerTransition(isFirst)}
          />
        )}

        {/* Emoji */}
        <motion.span
          style={{ fontSize: sizeStyle.emojiSize, lineHeight: 1 }}
          animate={isFirst ? badgeVibrate : undefined}
          transition={isFirst ? badgeVibrateTransition : undefined}
        >
          {config.emoji}
        </motion.span>

        {/* Place text */}
        <span>{config.label}</span>

        {/* Score if provided */}
        {score !== undefined && (
          <span style={{ opacity: 0.8, marginLeft: '0.25rem' }}>
            • {score} pts
          </span>
        )}
      </motion.div>
    </motion.div>
  );
}
