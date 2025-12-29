import { useState, useCallback, useRef, useEffect } from 'react';

export function useGameError() {
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showError = useCallback((message: string, duration = 5000) => {
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
