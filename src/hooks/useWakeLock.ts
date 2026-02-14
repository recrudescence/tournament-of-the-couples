import { useCallback, useEffect, useRef, useState } from 'react';
import NoSleep from 'nosleep.js';

/**
 * Hook to prevent screen from sleeping on mobile devices
 * Uses NoSleep.js which falls back to a hidden video loop
 * when the Wake Lock API isn't available.
 *
 * Handles document visibility - only acquires lock when visible,
 * and re-acquires when document becomes visible again.
 */
export function useWakeLock() {
  const noSleepRef = useRef<NoSleep | null>(null);
  const [isActive, setIsActive] = useState(false);
  const wantActiveRef = useRef(false); // Track if we want wake lock active

  // Initialize NoSleep instance
  useEffect(() => {
    noSleepRef.current = new NoSleep();
    return () => {
      if (noSleepRef.current) {
        noSleepRef.current.disable();
      }
    };
  }, []);

  // Handle visibility changes - re-acquire lock when document becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wantActiveRef.current && noSleepRef.current) {
        // Document became visible and we want the lock - try to acquire
        noSleepRef.current.enable()
          .then(() => setIsActive(true))
          .catch(() => {
            // Silently fail - will retry on next visibility change
          });
      } else if (document.visibilityState === 'hidden' && isActive) {
        // Document hidden - the lock is automatically released by the browser
        setIsActive(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive]);

  const requestWakeLock = useCallback(() => {
    wantActiveRef.current = true;

    // Only try to enable if document is visible
    if (noSleepRef.current && !isActive && document.visibilityState === 'visible') {
      noSleepRef.current.enable()
        .then(() => setIsActive(true))
        .catch(() => {
          // Failed to acquire - will retry when document becomes visible
        });
    }
  }, [isActive]);

  const releaseWakeLock = useCallback(() => {
    wantActiveRef.current = false;

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
