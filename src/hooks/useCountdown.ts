import { useState, useRef, useEffect, useCallback } from 'react';

const POOL_SELECTION_DURATION = 30000; // 30 seconds

interface UseCountdownOptions {
  duration?: number;
  onExpire?: () => void;
}

export function useCountdown({ duration = POOL_SELECTION_DURATION, onExpire }: UseCountdownOptions = {}) {
  const [remaining, setRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (isRunning && startTimeRef.current !== null) {
      intervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current!;
        const newRemaining = Math.max(0, duration - elapsed);
        setRemaining(newRemaining);

        if (newRemaining === 0 && !expiredRef.current) {
          expiredRef.current = true;
          setIsRunning(false);
          onExpire?.();
        }
      }, 100); // Update every 100ms

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isRunning, duration, onExpire]);

  /**
   * Start the countdown. If serverTimestamp is provided, calculates
   * remaining time from that timestamp (for reconnection sync).
   */
  const start = useCallback((serverTimestamp?: number) => {
    expiredRef.current = false;
    if (serverTimestamp !== undefined) {
      startTimeRef.current = serverTimestamp;
      const elapsed = Date.now() - serverTimestamp;
      const newRemaining = Math.max(0, duration - elapsed);
      setRemaining(newRemaining);

      // If already expired, trigger callback immediately
      if (newRemaining === 0) {
        expiredRef.current = true;
        onExpire?.();
        return;
      }
    } else {
      startTimeRef.current = Date.now();
      setRemaining(duration);
    }
    setIsRunning(true);
  }, [duration, onExpire]);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    expiredRef.current = false;
    setRemaining(duration);
    startTimeRef.current = null;
  }, [stop, duration]);

  return {
    remaining,
    isRunning,
    isExpired: remaining === 0,
    start,
    stop,
    reset
  };
}
