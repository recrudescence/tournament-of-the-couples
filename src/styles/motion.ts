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
// HELPER: Create staggered delay transition
// ============================================================================

export function withDelay(transition: Transition, delay: number): Transition {
  return { ...transition, delay };
}

export function staggerDelay(index: number, base = 0, increment = 0.1): number {
  return base + index * increment;
}
