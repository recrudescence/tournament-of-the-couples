import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { usePlayerInfo } from '../usePlayerInfo';
import type { PlayerInfo } from '../../types/game';

describe('usePlayerInfo', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should initialize with null when no stored data', () => {
    const { result } = renderHook(() => usePlayerInfo());

    expect(result.current.playerInfo).toBeNull();
  });

  it('should initialize with stored data from sessionStorage', () => {
    const storedInfo: PlayerInfo = {
      name: 'Alice',
      isHost: false,
      roomCode: 'test',
    };

    sessionStorage.setItem('playerInfo', JSON.stringify(storedInfo));

    const { result } = renderHook(() => usePlayerInfo());

    expect(result.current.playerInfo).toEqual(storedInfo);
  });

  it('should save player info to sessionStorage and state', () => {
    const { result } = renderHook(() => usePlayerInfo());

    const newInfo: PlayerInfo = {
      name: 'Bob',
      isHost: true,
      roomCode: 'game',
    };

    act(() => {
      result.current.savePlayerInfo(newInfo);
    });

    expect(result.current.playerInfo).toEqual(newInfo);
    expect(sessionStorage.getItem('playerInfo')).toBe(JSON.stringify(newInfo));
  });

  it('should clear player info from sessionStorage and state', () => {
    const { result } = renderHook(() => usePlayerInfo());

    const info: PlayerInfo = {
      name: 'Charlie',
      isHost: false,
      roomCode: 'room',
    };

    act(() => {
      result.current.savePlayerInfo(info);
    });

    expect(result.current.playerInfo).toEqual(info);

    act(() => {
      result.current.clearPlayerInfo();
    });

    expect(result.current.playerInfo).toBeNull();
    expect(sessionStorage.getItem('playerInfo')).toBeNull();
  });

  it('should handle invalid JSON in sessionStorage gracefully', () => {
    sessionStorage.setItem('playerInfo', 'invalid json {]');

    const { result } = renderHook(() => usePlayerInfo());

    expect(result.current.playerInfo).toBeNull();
  });

  it('should update state when savePlayerInfo is called multiple times', () => {
    const { result } = renderHook(() => usePlayerInfo());

    const firstInfo: PlayerInfo = {
      name: 'Player1',
      isHost: false,
      roomCode: 'room1',
    };

    const secondInfo: PlayerInfo = {
      name: 'Player2',
      isHost: true,
      roomCode: 'room2',
    };

    act(() => {
      result.current.savePlayerInfo(firstInfo);
    });

    expect(result.current.playerInfo).toEqual(firstInfo);

    act(() => {
      result.current.savePlayerInfo(secondInfo);
    });

    expect(result.current.playerInfo).toEqual(secondInfo);
    expect(sessionStorage.getItem('playerInfo')).toBe(JSON.stringify(secondInfo));
  });

  it('should use stable callback references', () => {
    const { result, rerender } = renderHook(() => usePlayerInfo());

    const firstSave = result.current.savePlayerInfo;
    const firstClear = result.current.clearPlayerInfo;

    rerender();

    expect(result.current.savePlayerInfo).toBe(firstSave);
    expect(result.current.clearPlayerInfo).toBe(firstClear);
  });

  it('should handle storage event when sessionStorage is updated externally', () => {
    const { result } = renderHook(() => usePlayerInfo());

    const externalInfo: PlayerInfo = {
      name: 'External',
      isHost: true,
      roomCode: 'external',
    };

    // Simulate external change
    act(() => {
      sessionStorage.setItem('playerInfo', JSON.stringify(externalInfo));
      window.dispatchEvent(new Event('storage'));
    });

    expect(result.current.playerInfo).toEqual(externalInfo);
  });

  it('should handle storage event when sessionStorage is cleared externally', () => {
    const { result } = renderHook(() => usePlayerInfo());

    const info: PlayerInfo = {
      name: 'Test',
      isHost: false,
      roomCode: 'test',
    };

    act(() => {
      result.current.savePlayerInfo(info);
    });

    expect(result.current.playerInfo).toEqual(info);

    // Simulate external clear
    act(() => {
      sessionStorage.removeItem('playerInfo');
      window.dispatchEvent(new Event('storage'));
    });

    expect(result.current.playerInfo).toBeNull();
  });
});
