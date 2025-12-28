import { useEffect } from 'react';
import confetti from 'canvas-confetti';

/**
 * Hook for celebration confetti effect
 */
export function useCelebrationConfetti(shouldTrigger: boolean) {
  useEffect(() => {
    if (!shouldTrigger) return;

    // Fire confetti multiple times for effect
    const duration = 5000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 15, spread: 360, ticks: 260, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

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

    const duration = 15 * 60 * 1000; // 15 minutes
    const animationEnd = Date.now() + duration;
    let skew = 1;

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      const ticks = Math.max(200, 500 * (timeLeft / duration));

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
