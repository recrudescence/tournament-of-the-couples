import { useEffect } from 'react';
import confetti from 'canvas-confetti';

// Confetti animation constants
const CELEBRATION_DURATION_MS = 5000;
const CELEBRATION_START_VELOCITY = 15;
const CELEBRATION_SPREAD = 360;
const CELEBRATION_TICKS = 260;

const SNOW_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Fire a burst of boom emojis from a specific point
 */
export function fireBoomBurst(event?: React.MouseEvent) {
  const boom = confetti.shapeFromText({ text: '💥' });

  // Convert click position to 0-1 coordinates, or use center as fallback
  const origin = event
    ? { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight }
    : { x: 0.5, y: 0.5 };

  confetti({
    particleCount: 32,
    startVelocity: 10,
    spread: 180,
    ticks: 60,
    origin,
    shapes: [boom],
    scalar: 2,
    flat: true
  });
}

/**
 * Hook for celebration confetti effect
 */
export function useCelebrationConfetti(shouldTrigger: boolean) {
  useEffect(() => {
    if (!shouldTrigger) return;

    // Fire confetti multiple times for effect
    const animationEnd = Date.now() + CELEBRATION_DURATION_MS;
    const defaults = {
      startVelocity: CELEBRATION_START_VELOCITY,
      spread: CELEBRATION_SPREAD,
      ticks: CELEBRATION_TICKS,
      zIndex: 0
    };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / CELEBRATION_DURATION_MS);

      // Fire confetti from random positions
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, [shouldTrigger]);
}

/**
 * Fire a directional burst of confetti from a specific position (for scoring)
 */
export function fireScoringBurst(originX: number, originY: number, points: number) {
  const colors = points === 2 ? ['#ff9c29', '#ff4c4c'] : ['#48c774', '#3ec46d'];
  confetti({
    particleCount: 25 + (points * 10),
    startVelocity: 30,
    spread: 70,
    angle: 30, // Fire to the right
    origin: { x: originX, y: originY },
    colors,
    ticks: 100,
    gravity: .7,
    scalar: 0.8
  });
}

/**
 * Fire a place-colored burst from a specific position (for podium changes)
 */
const placeColors: Record<number, string[]> = {
  1: ['#FFD700', '#FFA500', '#FFEC80'],
  2: ['#C0C0C0', '#E8E8E8', '#A0A0A0'],
  3: ['#CD7F32', '#DAA06D', '#B87333'],
};

export function firePlaceBurst(origin: { x: number; y: number }, place: number) {
  const colors = placeColors[place];
  if (!colors) return;
  confetti({
    particleCount: place === 1 ? 60 : place === 2 ? 40 : 25,
    startVelocity: 25,
    spread: 70,
    angle: 120,
    origin,
    colors,
    ticks: 120,
    gravity: 0.8,
  });
}

/**
 * Hook for falling snow effect
 */
export function useSnowEffect(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const animationEnd = Date.now() + SNOW_DURATION_MS;
    let skew = 1;

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      const ticks = Math.max(200, 500 * (timeLeft / SNOW_DURATION_MS));

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      skew = Math.max(0.8, skew - 0.001);

      confetti({
        particleCount: 1,
        startVelocity: 0,
        ticks: ticks,
        origin: {
          x: Math.random(),
          y: Math.random() * skew - 0.2
        },
        colors: ['#ffffff'],
        shapes: [confetti.shapeFromText({ text: '❄️' })],
        gravity: randomInRange(0.2, 0.3),
        scalar: randomInRange(0.8, 2),
        drift: randomInRange(-0.4, 0.4),
        flat: true
      });
    }, 500);

    return () => clearInterval(interval);
  }, [enabled]);
}
