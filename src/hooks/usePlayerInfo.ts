import { useState, useCallback, useEffect } from 'react';
import type { PlayerInfo } from '../types/game';

const STORAGE_KEY = 'playerInfo';

export function usePlayerInfo() {
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        setPlayerInfo(stored ? JSON.parse(stored) : null);
      } catch {
        setPlayerInfo(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const savePlayerInfo = useCallback((info: PlayerInfo) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    setPlayerInfo(info);
  }, []);

  const clearPlayerInfo = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPlayerInfo(null);
  }, []);

  return { playerInfo, savePlayerInfo, clearPlayerInfo };
}
