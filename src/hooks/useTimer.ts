import { useState, useRef, useEffect, useCallback } from 'react';

export function useTimer() {
  const [responseTime, setResponseTime] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerStartRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRunning) {
      if (!timerStartRef.current) {
        timerStartRef.current = Date.now();
      }

      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - (timerStartRef.current || Date.now());
        setResponseTime(elapsed);
      }, 10); // Update every 10ms for smooth display

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    } else {
      // Timer stopped - clear interval and ref
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, [timerRunning]);

  /**
   * Start the timer. If serverTimestamp is provided, the timer will
   * calculate elapsed time from that timestamp (allows accurate timing
   * across reconnections). Otherwise uses Date.now().
   */
  const startTimer = useCallback((serverTimestamp?: number) => {
    if (serverTimestamp !== undefined) {
      // Use server timestamp for accurate cross-client timing
      timerStartRef.current = serverTimestamp;
      setResponseTime(Date.now() - serverTimestamp);
    } else {
      setResponseTime(0);
      timerStartRef.current = null;
    }
    setTimerRunning(true);
  }, []);

  const stopTimer = useCallback(() => {
    setTimerRunning(false);
  }, []);

  const getFinalTime = useCallback(() => {
    return timerStartRef.current
      ? Date.now() - timerStartRef.current
      : responseTime;
  }, [responseTime]);

  return {
    responseTime,
    timerRunning,
    startTimer,
    stopTimer,
    getFinalTime
  };
}
