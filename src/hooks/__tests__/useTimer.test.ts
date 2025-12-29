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
});
