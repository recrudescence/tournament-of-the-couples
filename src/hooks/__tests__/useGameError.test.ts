import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameError } from '../useGameError';

describe('useGameError', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with no error', () => {
    const { result } = renderHook(() => useGameError());

    expect(result.current.error).toBeNull();
  });

  it('should show error when showError is called', () => {
    const { result } = renderHook(() => useGameError());

    act(() => {
      result.current.showError('Test error message');
    });

    expect(result.current.error).toBe('Test error message');
  });

  it('should auto-clear error after default duration (5000ms)', () => {
    const { result } = renderHook(() => useGameError());

    act(() => {
      result.current.showError('Test error message');
    });

    expect(result.current.error).toBe('Test error message');

    // Fast-forward time by 5000ms
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.error).toBeNull();
  });

  it('should auto-clear error after custom duration', () => {
    const { result } = renderHook(() => useGameError());

    act(() => {
      result.current.showError('Test error message', 3000);
    });

    expect(result.current.error).toBe('Test error message');

    // Fast-forward time by 2999ms - should still be there
    act(() => {
      vi.advanceTimersByTime(2999);
    });

    expect(result.current.error).toBe('Test error message');

    // Fast-forward by 1 more ms - should be cleared
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.error).toBeNull();
  });

  it('should not auto-clear error when duration is 0', () => {
    const { result } = renderHook(() => useGameError());

    act(() => {
      result.current.showError('Test error message', 0);
    });

    expect(result.current.error).toBe('Test error message');

    // Fast-forward time by a lot
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Should still be there
    expect(result.current.error).toBe('Test error message');
  });

  it('should manually clear error with clearError', () => {
    const { result } = renderHook(() => useGameError());

    act(() => {
      result.current.showError('Test error message');
    });

    expect(result.current.error).toBe('Test error message');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should replace existing error with new error', () => {
    const { result } = renderHook(() => useGameError());

    act(() => {
      result.current.showError('First error');
    });

    expect(result.current.error).toBe('First error');

    act(() => {
      result.current.showError('Second error');
    });

    expect(result.current.error).toBe('Second error');
  });

  it('should use stable callback references', () => {
    const { result, rerender } = renderHook(() => useGameError());

    const firstShowError = result.current.showError;
    const firstClearError = result.current.clearError;

    rerender();

    expect(result.current.showError).toBe(firstShowError);
    expect(result.current.clearError).toBe(firstClearError);
  });
});
