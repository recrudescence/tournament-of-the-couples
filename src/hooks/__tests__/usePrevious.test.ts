import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePrevious } from '../usePrevious';

describe('usePrevious', () => {
  it('returns undefined on initial render', () => {
    const { result } = renderHook(() => usePrevious('initial'));

    expect(result.current).toBeUndefined();
  });

  it('returns previous value after re-render', () => {
    const { result, rerender } = renderHook(
      ({ value }) => usePrevious(value),
      { initialProps: { value: 'first' } }
    );

    expect(result.current).toBeUndefined();

    rerender({ value: 'second' });
    expect(result.current).toBe('first');

    rerender({ value: 'third' });
    expect(result.current).toBe('second');
  });

  it('works with number values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => usePrevious(value),
      { initialProps: { value: 0 } }
    );

    expect(result.current).toBeUndefined();

    rerender({ value: 1 });
    expect(result.current).toBe(0);

    rerender({ value: 42 });
    expect(result.current).toBe(1);
  });

  it('works with boolean values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => usePrevious(value),
      { initialProps: { value: false } }
    );

    expect(result.current).toBeUndefined();

    rerender({ value: true });
    expect(result.current).toBe(false);

    rerender({ value: false });
    expect(result.current).toBe(true);
  });

  it('works with object values', () => {
    const obj1 = { name: 'Alice' };
    const obj2 = { name: 'Bob' };

    const { result, rerender } = renderHook(
      ({ value }) => usePrevious(value),
      { initialProps: { value: obj1 } }
    );

    expect(result.current).toBeUndefined();

    rerender({ value: obj2 });
    expect(result.current).toBe(obj1);
    expect(result.current).toEqual({ name: 'Alice' });
  });

  it('works with null and undefined values', () => {
    const { result, rerender } = renderHook(
      ({ value }) => usePrevious(value),
      { initialProps: { value: null as string | null } }
    );

    expect(result.current).toBeUndefined();

    rerender({ value: 'value' });
    expect(result.current).toBeNull();

    rerender({ value: null });
    expect(result.current).toBe('value');
  });

  it('returns same value when re-rendered with same value', () => {
    const { result, rerender } = renderHook(
      ({ value }) => usePrevious(value),
      { initialProps: { value: 'same' } }
    );

    expect(result.current).toBeUndefined();

    rerender({ value: 'same' });
    // After rerender with same value, previous should still be 'same'
    // because the effect runs after render and updates ref
    expect(result.current).toBe('same');

    rerender({ value: 'same' });
    expect(result.current).toBe('same');
  });

  it('tracks value changes across many re-renders', () => {
    const { result, rerender } = renderHook(
      ({ value }) => usePrevious(value),
      { initialProps: { value: 1 } }
    );

    for (let i = 2; i <= 10; i++) {
      rerender({ value: i });
      expect(result.current).toBe(i - 1);
    }
  });
});
