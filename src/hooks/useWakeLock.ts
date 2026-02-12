import { useCallback, useEffect, useRef, useState } from 'react';
import NoSleep from 'nosleep.js';

/**
 * Hook to prevent screen from sleeping on mobile devices
 * Uses NoSleep.js which falls back to a hidden video loop
 * when the Wake Lock API isn't available
 */
export function useWakeLock() {
  const noSleepRef = useRef<NoSleep | null>(null);
  const [isActive, setIsActive] = useState(false);

  // Initialize NoSleep instance
  useEffect(() => {
    noSleepRef.current = new NoSleep();
    return () => {
      if (noSleepRef.current) {
        noSleepRef.current.disable();
      }
    };
  }, []);

  const requestWakeLock = useCallback(() => {
    if (noSleepRef.current && !isActive) {
      noSleepRef.current.enable();
      setIsActive(true);
    }
  }, [isActive]);

  const releaseWakeLock = useCallback(() => {
    if (noSleepRef.current && isActive) {
      noSleepRef.current.disable();
      setIsActive(false);
    }
  }, [isActive]);

  return {
    isSupported: true, // NoSleep.js always works via video fallback
    isActive,
    requestWakeLock,
    releaseWakeLock,
  };
}
