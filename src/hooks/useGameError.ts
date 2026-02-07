import { useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_ERROR_DURATION_MS = 5000;

export function useGameError() {
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = useCallback((message: string, duration = DEFAULT_ERROR_DURATION_MS) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setError(message);
    if (duration > 0) {
      timeoutRef.current = setTimeout(() => {
        setError(null);
        timeoutRef.current = null;
      }, duration);
    }
  }, []);

  const clearError = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setError(null);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { error, showError, clearError };
}
