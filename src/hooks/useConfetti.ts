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
