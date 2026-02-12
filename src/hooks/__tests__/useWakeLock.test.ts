import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock NoSleep.js - must be defined before import due to hoisting
const mockEnable = vi.fn();
const mockDisable = vi.fn();

vi.mock('nosleep.js', () => ({
  default: class MockNoSleep {
    enable = mockEnable;
    disable = mockDisable;
  },
}));

import { useWakeLock } from '../useWakeLock';

describe('useWakeLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isSupported', () => {
    it('always returns true since NoSleep.js has video fallback', () => {
      const { result } = renderHook(() => useWakeLock());
      expect(result.current.isSupported).toBe(true);
    });
  });

  describe('requestWakeLock', () => {
    it('enables NoSleep when called', () => {
      const { result } = renderHook(() => useWakeLock());

      act(() => {
        result.current.requestWakeLock();
      });

      expect(mockEnable).toHaveBeenCalledTimes(1);
      expect(result.current.isActive).toBe(true);
    });

    it('does not enable again if already active', () => {
      const { result } = renderHook(() => useWakeLock());

      act(() => {
        result.current.requestWakeLock();
      });

      act(() => {
        result.current.requestWakeLock();
      });

      expect(mockEnable).toHaveBeenCalledTimes(1);
    });
  });

  describe('releaseWakeLock', () => {
    it('disables NoSleep when called', () => {
      const { result } = renderHook(() => useWakeLock());

      act(() => {
        result.current.requestWakeLock();
      });

      act(() => {
        result.current.releaseWakeLock();
      });

      expect(mockDisable).toHaveBeenCalledTimes(1);
      expect(result.current.isActive).toBe(false);
    });

    it('does nothing when not active', () => {
      const { result } = renderHook(() => useWakeLock());

      act(() => {
        result.current.releaseWakeLock();
      });

      expect(mockDisable).not.toHaveBeenCalled();
      expect(result.current.isActive).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('disables NoSleep on unmount', () => {
      const { unmount } = renderHook(() => useWakeLock());

      unmount();

      expect(mockDisable).toHaveBeenCalledTimes(1);
    });
  });
});
