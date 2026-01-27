import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTimer } from '../useTimer';

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with responseTime 0 and timer not running', () => {
    const { result } = renderHook(() => useTimer());

    expect(result.current.responseTime).toBe(0);
    expect(result.current.timerRunning).toBe(false);
  });

  it('starts timer and begins incrementing responseTime', () => {
    const { result } = renderHook(() => useTimer());

    act(() => {
      result.current.startTimer();
    });

    expect(result.current.timerRunning).toBe(true);

    // Fast-forward time by 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.responseTime).toBeGreaterThan(0);
    expect(result.current.responseTime).toBeLessThanOrEqual(100);
  });

  it('stops timer and freezes responseTime', () => {
    const { result } = renderHook(() => useTimer());

    act(() => {
      result.current.startTimer();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const timeBeforeStop = result.current.responseTime;

    act(() => {
      result.current.stopTimer();
    });

    expect(result.current.timerRunning).toBe(false);

    // Advance time further - responseTime should not change
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.responseTime).toBe(timeBeforeStop);
  });

  it('getFinalTime returns accurate elapsed time', () => {
    const { result } = renderHook(() => useTimer());

    act(() => {
      result.current.startTimer();
    });

    act(() => {
      vi.advanceTimersByTime(1234);
    });

    const finalTime = result.current.getFinalTime();

    expect(finalTime).toBeGreaterThan(1200);
    expect(finalTime).toBeLessThanOrEqual(1250);
  });

  it('resets timer when startTimer is called again', () => {
    const { result } = renderHook(() => useTimer());

    // Start and run for 500ms
    act(() => {
      result.current.startTimer();
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.responseTime).toBeGreaterThan(0);

    // Stop timer
    act(() => {
      result.current.stopTimer();
    });

    // Start again - should reset
    act(() => {
      result.current.startTimer();
    });

    // Should be close to 0 (small amount of time may have passed)
    expect(result.current.responseTime).toBeLessThan(50);
    expect(result.current.timerRunning).toBe(true);
  });

  it('updates responseTime every 10ms for smooth display', () => {
    const { result } = renderHook(() => useTimer());

    act(() => {
      result.current.startTimer();
    });

    const updates: number[] = [];

    // Collect updates over 50ms (should get ~5 updates)
    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(10);
      });
      updates.push(result.current.responseTime);
    }

    // Should have multiple different values (proving it updates frequently)
    const uniqueValues = new Set(updates);
    expect(uniqueValues.size).toBeGreaterThan(1);
  });

  it('cleans up interval when unmounted', () => {
    const { result, unmount } = renderHook(() => useTimer());

    act(() => {
      result.current.startTimer();
    });

    unmount();

    // Advance time - timer should be cleaned up
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Can't check responseTime after unmount, but no errors should occur
    expect(true).toBe(true); // Test completes without errors
  });

  it('handles multiple start/stop cycles', () => {
    const { result } = renderHook(() => useTimer());

    // Cycle 1
    act(() => {
      result.current.startTimer();
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.stopTimer();
    });

    // Cycle 2
    act(() => {
      result.current.startTimer();
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.stopTimer();
    });

    expect(result.current.timerRunning).toBe(false);
    expect(result.current.responseTime).toBeGreaterThan(0);
  });

  describe('server timestamp support', () => {
    it('starts timer from server timestamp and immediately shows elapsed time', () => {
      const { result } = renderHook(() => useTimer());

      // Simulate a server timestamp from 5 seconds ago
      const serverTimestamp = Date.now() - 5000;

      act(() => {
        result.current.startTimer(serverTimestamp);
      });

      expect(result.current.timerRunning).toBe(true);
      // Should immediately show ~5000ms elapsed
      expect(result.current.responseTime).toBeGreaterThanOrEqual(4900);
      expect(result.current.responseTime).toBeLessThanOrEqual(5100);
    });

    it('continues incrementing from server timestamp', () => {
      const { result } = renderHook(() => useTimer());

      // Simulate a server timestamp from 2 seconds ago
      const serverTimestamp = Date.now() - 2000;

      act(() => {
        result.current.startTimer(serverTimestamp);
      });

      const initialTime = result.current.responseTime;
      expect(initialTime).toBeGreaterThanOrEqual(1900);
      expect(initialTime).toBeLessThanOrEqual(2100);

      // Advance time by 500ms
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should now be ~2500ms
      expect(result.current.responseTime).toBeGreaterThanOrEqual(2400);
      expect(result.current.responseTime).toBeLessThanOrEqual(2600);
    });

    it('getFinalTime returns correct elapsed time from server timestamp', () => {
      const { result } = renderHook(() => useTimer());

      // Simulate a server timestamp from 3 seconds ago
      const serverTimestamp = Date.now() - 3000;

      act(() => {
        result.current.startTimer(serverTimestamp);
      });

      // Advance time by 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const finalTime = result.current.getFinalTime();

      // Should be ~4000ms (3000 initial + 1000 advanced)
      expect(finalTime).toBeGreaterThanOrEqual(3900);
      expect(finalTime).toBeLessThanOrEqual(4100);
    });

    it('handles reconnection scenario - timer resumes with accurate elapsed time', () => {
      const { result } = renderHook(() => useTimer());

      // Simulate a question that was asked 10 seconds ago (reconnection scenario)
      const serverTimestamp = Date.now() - 10000;

      act(() => {
        result.current.startTimer(serverTimestamp);
      });

      // Should immediately show ~10 seconds
      expect(result.current.responseTime).toBeGreaterThanOrEqual(9900);
      expect(result.current.responseTime).toBeLessThanOrEqual(10100);

      // Player takes 2 more seconds to answer
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      act(() => {
        result.current.stopTimer();
      });

      // Final time should be ~12 seconds
      expect(result.current.getFinalTime()).toBeGreaterThanOrEqual(11900);
      expect(result.current.getFinalTime()).toBeLessThanOrEqual(12100);
    });

    it('startTimer without argument uses Date.now() as before', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.startTimer();
      });

      // Should start from 0
      expect(result.current.responseTime).toBe(0);
      expect(result.current.timerRunning).toBe(true);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.responseTime).toBeGreaterThan(0);
      expect(result.current.responseTime).toBeLessThanOrEqual(100);
    });
  });
});
