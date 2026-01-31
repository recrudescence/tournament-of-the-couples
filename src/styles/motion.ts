import type { Transition, Variants } from 'framer-motion';

// ============================================================================
// TRANSITIONS - Reusable spring/timing configurations
// ============================================================================

export const springDefault: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
};

export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 15,
};

export const springStiff: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 20,
};

export const springGentle: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 20,
};

// ============================================================================
// VARIANTS - Named animation states (use with initial/animate props)
// ============================================================================

/** Simple fade in */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/** Slide in from the left */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0 },
};

/** Slide in from the right */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0 },
};

/** Slide up from below */
export const slideInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

/** Slide up from further below (for buttons, footers) */
export const slideInUpDeep: Variants = {
  hidden: { opacity: 0, y: 50, rotateX: -30 },
  visible: { opacity: 1, y: 0, rotateX: 0 },
};

/** 3D flip in from the left side */
export const flipInLeft: Variants = {
  hidden: { opacity: 0, rotateY: -90 },
  visible: { opacity: 1, rotateY: 0 },
};

/** 3D flip in from the right side */
export const flipInRight: Variants = {
  hidden: { opacity: 0, rotateY: 90 },
  visible: { opacity: 1, rotateY: 0 },
};

/** Pop in with spin (for badges, emojis) */
export const popInSpin: Variants = {
  hidden: { scale: 0, rotate: -180, y: -50 },
  visible: { scale: 1, rotate: 0, y: 0 },
  exit: { scale: 0, y: -30 },
};

/** Card entrance - tilts up from below */
export const cardEntrance: Variants = {
  hidden: { opacity: 0, rotateX: -15, y: 30 },
  visible: { opacity: 1, rotateX: 0, y: 0 },
};

/** Scale pop (for containers) */
export const scalePop: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
};

/** Emoji spin entrance */
export const emojiSpin: Variants = {
  hidden: { scale: 0, rotate: -180 },
  visible: { scale: 1, rotate: 0 },
};

// ============================================================================
// INTERACTION PRESETS - whileHover / whileTap configurations
// ============================================================================

/** Standard button hover - subtle scale */
export const buttonHover = { scale: 1.05 };
export const buttonTap = { scale: 0.95 };

/** Lift hover - for larger buttons, cards that should "pop" */
export const liftHover = {
  scale: 1.08,
  y: -4,
  boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
};
export const liftTap = {
  scale: 0.92,
  y: 2,
};

/** Card hover - subtle 3D tilt */
export const cardHover = {
  scale: 1.02,
  rotateX: -3,
  boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
};
export const cardTap = { scale: 0.98 };

/** Nervous shake (for destructive buttons) */
export const nervousHover = {
  scale: 1.05,
  rotate: [-1, 1, -1, 0],
  transition: { rotate: { repeat: Infinity, duration: 0.3 } },
};

// ============================================================================
// MODAL VARIANTS - For AnimatePresence modals
// ============================================================================

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Modal card entrance - use with dynamic initial values for random tilt.
 * Example: initial={{ ...modalCard.hidden, rotateZ: randomTilt }}
 */
export const modalCard: Variants = {
  hidden: { scale: 0.3, rotateX: -20, y: -100, opacity: 0 },
  visible: { scale: 1, rotateX: 0, rotateZ: 0, y: 0, opacity: 1 },
  exit: { scale: 0.5, rotateX: 20, y: 100, opacity: 0 },
};

// ============================================================================
// FLIP CARD - For answer reveal cards
// ============================================================================

export const flipCard: Variants = {
  front: { rotateY: 0 },
  back: { rotateY: 180 },
};

// ============================================================================
// PLACE BADGE - Animated badges for 1st/2nd/3rd place
// ============================================================================

/** Badge entrance - scale up with slight rotation */
export const badgeEntrance: Variants = {
  hidden: { scale: 0, rotate: -10 },
  visible: { scale: 1, rotate: 0 },
};

/** Badge floating animation (continuous) */
export const badgeFloat = {
  y: [0, -3, 0],
};

export const badgeFloatTransition: Transition = {
  duration: 2,
  repeat: Infinity,
  ease: 'easeInOut',
};

/** Shimmer sweep animation (continuous) */
export const badgeShimmer = {
  backgroundPosition: ['200% 0%', '-200% 0%'],
};

export const badgeShimmerTransition = (fast: boolean): Transition => ({
  duration: fast ? 1.5 : 2,
  repeat: Infinity,
  ease: 'linear',
  repeatDelay: fast ? 0.5 : 1,
});

/** Gold badge vibrate animation (continuous) */
export const badgeVibrate = {
  rotate: [-1, 1, -1, 1, 0],
  scale: [1, 1.05, 1],
};

export const badgeVibrateTransition: Transition = {
  duration: 0.5,
  repeat: Infinity,
  repeatDelay: 1.5,
};

/** Badge shadow pulse - creates floating shadow effect */
export function badgeShadowKeyframes(shadowColor: string) {
  const base = `0 4px 12px ${shadowColor}, inset 0 1px 2px rgba(255,255,255,0.4)`;
  const lifted = `0 8px 20px ${shadowColor}, inset 0 1px 2px rgba(255,255,255,0.4)`;
  return [base, lifted, base];
}

// ============================================================================
// BUBBLE ANIMATIONS - For lobby player bubbles
// ============================================================================

/** Bubble float animation (continuous) - varies by index for staggered effect */
export function bubbleFloat(index: number) {
  const yAmount = 4 + (index % 3); // 4-6px variation
  const rotateAmount = 1 + (index % 2); // 1-2deg variation
  return {
    y: [0, -yAmount, 0],
    rotate: [0, rotateAmount, 0, -rotateAmount, 0],
  };
}

export function bubbleFloatTransition(index: number): Transition {
  const baseDuration = 3 + (index % 3) * 0.5; // 3-4.5s variation
  return {
    duration: baseDuration,
    repeat: Infinity,
    ease: 'easeInOut',
    delay: index * 0.2, // stagger start times
  };
}

/** Bubble entrance - scale + slight rotation */
export const bubbleEntrance: Variants = {
  hidden: { opacity: 0, scale: 0.5, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.5, y: -20 },
};

/** Bubble hover - lift with shadow */
export const bubbleHover = {
  scale: 1.05,
  y: -4,
  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
};

export const bubbleTap = {
  scale: 0.95,
};

// ============================================================================
// HELPER: Create staggered delay transition
// ============================================================================

export function withDelay(transition: Transition, delay: number): Transition {
  return { ...transition, delay };
}

export function staggerDelay(index: number, base = 0, increment = 0.1): number {
  return base + index * increment;
}
