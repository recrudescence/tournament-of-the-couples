/* eslint-disable @typescript-eslint/no-explicit-any */
// Disabled for this file: mocking browser APIs (navigator.wakeLock) requires any casts

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWakeLock } from '../useWakeLock';

// Mock WakeLockSentinel
type EventHandler = () => void;

class MockWakeLockSentinel {
  private listeners: Map<string, EventHandler[]> = new Map();
  released = false;

  addEventListener(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  removeEventListener(event: string, handler: EventHandler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  async release() {
    this.released = true;
    const handlers = this.listeners.get('release');
    if (handlers) {
      handlers.forEach(handler => handler());
    }
    return Promise.resolve();
  }
}

describe('useWakeLock', () => {
  let mockWakeLockSentinel: MockWakeLockSentinel;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockWakeLockSentinel = new MockWakeLockSentinel();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    // Clean up navigator.wakeLock if it was mocked
    if ('wakeLock' in navigator) {
      delete (navigator as any).wakeLock;
    }
  });

  describe('isSupported', () => {
    it('returns true when Wake Lock API is supported', () => {
      (navigator as any).wakeLock = {
        request: vi.fn().mockResolvedValue(mockWakeLockSentinel),
      };

      const { result } = renderHook(() => useWakeLock());

      expect(result.current.isSupported).toBe(true);
    });

    it('returns false when Wake Lock API is not supported', () => {
      const { result } = renderHook(() => useWakeLock());

      expect(result.current.isSupported).toBe(false);
    });
  });

  describe('requestWakeLock', () => {
    beforeEach(() => {
      (navigator as any).wakeLock = {
        request: vi.fn().mockResolvedValue(mockWakeLockSentinel),
      };
    });

    it('requests wake lock when supported and document is visible', async () => {
      const { result } = renderHook(() => useWakeLock());

      await act(async () => {
        await result.current.requestWakeLock();
      });

      expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
      await waitFor(() => expect(result.current.isActive).toBe(true));
    });

    it('does not request wake lock when document is hidden', async () => {
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'hidden',
      });

      const { result } = renderHook(() => useWakeLock());

      await act(async () => {
        await result.current.requestWakeLock();
      });

      expect(navigator.wakeLock.request).not.toHaveBeenCalled();
      expect(result.current.isActive).toBe(false);
    });

    it('does not request wake lock when API is not supported', async () => {
      delete (navigator as any).wakeLock;

      const { result } = renderHook(() => useWakeLock());

      await act(async () => {
        await result.current.requestWakeLock();
      });

      expect(result.current.isActive).toBe(false);
    });

    it('handles wake lock request errors gracefully', async () => {
      const mockError = new Error('Wake lock request failed');
      (navigator as any).wakeLock = {
        request: vi.fn().mockRejectedValue(mockError),
      };

      const { result } = renderHook(() => useWakeLock());

      await act(async () => {
        await result.current.requestWakeLock();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[WakeLock] Failed to acquire wake lock:',
        mockError
      );
      expect(result.current.isActive).toBe(false);
    });

    it('sets isActive to false when wake lock is released', async () => {
      const { result } = renderHook(() => useWakeLock());

      await act(async () => {
        await result.current.requestWakeLock();
      });

      await waitFor(() => expect(result.current.isActive).toBe(true));

      // Simulate wake lock release
      await act(async () => {
        await mockWakeLockSentinel.release();
      });

      await waitFor(() => expect(result.current.isActive).toBe(false));
    });
  });

  describe('releaseWakeLock', () => {
    beforeEach(() => {
      (navigator as any).wakeLock = {
        request: vi.fn().mockResolvedValue(mockWakeLockSentinel),
      };
    });

    it('releases active wake lock', async () => {
      const { result } = renderHook(() => useWakeLock());

      await act(async () => {
        await result.current.requestWakeLock();
      });

      await waitFor(() => expect(result.current.isActive).toBe(true));

      await act(async () => {
        await result.current.releaseWakeLock();
      });

      await waitFor(() => expect(result.current.isActive).toBe(false));
      expect(mockWakeLockSentinel.released).toBe(true);
    });

    it('does nothing when no wake lock is active', async () => {
      const { result } = renderHook(() => useWakeLock());

      await act(async () => {
        await result.current.releaseWakeLock();
      });

      expect(result.current.isActive).toBe(false);
    });

    it('handles wake lock release errors gracefully', async () => {
      const mockError = new Error('Release failed');
      const errorSentinel = {
        ...mockWakeLockSentinel,
        release: vi.fn().mockRejectedValue(mockError),
      };

      (navigator as any).wakeLock = {
        request: vi.fn().mockResolvedValue(errorSentinel),
      };

      const { result } = renderHook(() => useWakeLock());

      await act(async () => {
        await result.current.requestWakeLock();
      });

      await act(async () => {
        await result.current.releaseWakeLock();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[WakeLock] Failed to release wake lock:',
        mockError
      );
    });
  });

  describe('visibilitychange handling', () => {
    beforeEach(() => {
      (navigator as any).wakeLock = {
        request: vi.fn().mockResolvedValue(mockWakeLockSentinel),
      };
    });

    it.skip('re-acquires wake lock when page becomes visible', async () => {
      const { result } = renderHook(() => useWakeLock());

      // Initially request wake lock
      await act(async () => {
        await result.current.requestWakeLock();
      });

      await waitFor(() => expect(result.current.isActive).toBe(true));

      // Simulate page becoming hidden (wake lock released)
      await act(async () => {
        await mockWakeLockSentinel.release();
      });

      await waitFor(() => expect(result.current.isActive).toBe(false));

      // Clear previous calls
      vi.clearAllMocks();
      mockWakeLockSentinel = new MockWakeLockSentinel();
      (navigator as any).wakeLock.request = vi.fn().mockResolvedValue(mockWakeLockSentinel);

      // Simulate page becoming visible again
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'visible',
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await waitFor(() => expect(navigator.wakeLock.request).toHaveBeenCalled());
    });

    it('does not re-acquire wake lock when API is not supported', async () => {
      delete (navigator as any).wakeLock;

      const { result } = renderHook(() => useWakeLock());

      expect(result.current.isSupported).toBe(false);

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(result.current.isActive).toBe(false);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      (navigator as any).wakeLock = {
        request: vi.fn().mockResolvedValue(mockWakeLockSentinel),
      };
    });

    it('releases wake lock on unmount', async () => {
      const { result, unmount } = renderHook(() => useWakeLock());

      await act(async () => {
        await result.current.requestWakeLock();
      });

      await waitFor(() => expect(result.current.isActive).toBe(true));

      unmount();

      expect(mockWakeLockSentinel.released).toBe(true);
    });

    it('cleans up visibilitychange listener on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useWakeLock());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });
});
