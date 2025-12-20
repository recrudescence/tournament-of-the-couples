import { useState, useCallback } from 'react';

export function useGameError() {
  const [error, setError] = useState<string | null>(null);

  const showError = useCallback((message: string, duration = 5000) => {
    setError(message);
    if (duration > 0) {
      setTimeout(() => setError(null), duration);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { error, showError, clearError };
}
