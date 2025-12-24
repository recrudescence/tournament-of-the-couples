import { useEffect, useRef, useState } from 'react';

/**
 * Hook to prevent screen from sleeping on mobile devices
 * Uses the Wake Lock API when available
 */
export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Check if Wake Lock API is supported
    setIsSupported('wakeLock' in navigator);
  }, []);

  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) {
      return;
    }

    // Only request wake lock if document is visible
    if (document.visibilityState !== 'visible') {
      return;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);

      wakeLockRef.current.addEventListener('release', () => {
        setIsActive(false);
      });
    } catch (err) {
      console.error('[WakeLock] Failed to acquire wake lock:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
      } catch (err) {
        console.error('[WakeLock] Failed to release wake lock:', err);
      }
    }
  };

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current === null && isSupported) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.error);
      }
    };
  }, []);

  return {
    isSupported,
    isActive,
    requestWakeLock,
    releaseWakeLock,
  };
}
