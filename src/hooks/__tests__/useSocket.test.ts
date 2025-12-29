import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSocket } from '../useSocket';
import * as SocketContext from '../../context/SocketContext';
import type { Socket } from 'socket.io-client';

describe('useSocket', () => {
  let mockSocket: Partial<Socket>;
  let mockEmit: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
  let mockOff: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEmit = vi.fn();
    mockOn = vi.fn();
    mockOff = vi.fn();

    mockSocket = {
      emit: mockEmit as any,
      on: mockOn as any,
      off: mockOff as any,
    };

    vi.spyOn(SocketContext, 'useSocketContext').mockReturnValue({
      socket: mockSocket as Socket,
      isConnected: true,
    });
  });

  it('should return socket and isConnected from context', () => {
    const { result } = renderHook(() => useSocket());

    expect(result.current.socket).toBe(mockSocket);
    expect(result.current.isConnected).toBe(true);
  });

  it('should emit events to socket', () => {
    const { result } = renderHook(() => useSocket());

    act(() => {
      result.current.emit('createGame', { name: 'Alice' });
    });

    expect(mockEmit).toHaveBeenCalledWith('createGame', { name: 'Alice' });
  });

  it('should not emit when socket is null', () => {
    vi.spyOn(SocketContext, 'useSocketContext').mockReturnValue({
      socket: null,
      isConnected: false,
    });

    const { result } = renderHook(() => useSocket());

    act(() => {
      result.current.emit('createGame', { name: 'Alice' });
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('should register event listeners with on', () => {
    const { result } = renderHook(() => useSocket());
    const handler = vi.fn();

    act(() => {
      result.current.on('gameCreated', handler);
    });

    expect(mockOn).toHaveBeenCalledWith('gameCreated', handler);
  });

  it('should return cleanup function that removes listener', () => {
    const { result } = renderHook(() => useSocket());
    const handler = vi.fn();

    let cleanup: (() => void) | undefined;

    act(() => {
      cleanup = result.current.on('gameCreated', handler);
    });

    expect(cleanup).toBeDefined();

    act(() => {
      cleanup!();
    });

    expect(mockOff).toHaveBeenCalledWith('gameCreated', handler);
  });

  it('should return no-op cleanup when socket is null', () => {
    vi.spyOn(SocketContext, 'useSocketContext').mockReturnValue({
      socket: null,
      isConnected: false,
    });

    const { result } = renderHook(() => useSocket());
    const handler = vi.fn();

    let cleanup: (() => void) | undefined;

    act(() => {
      cleanup = result.current.on('gameCreated', handler);
    });

    expect(mockOn).not.toHaveBeenCalled();
    expect(cleanup).toBeDefined();

    // Should not throw
    act(() => {
      cleanup!();
    });

    expect(mockOff).not.toHaveBeenCalled();
  });

  it('should use stable callback references', () => {
    const { result, rerender } = renderHook(() => useSocket());

    const firstEmit = result.current.emit;
    const firstOn = result.current.on;

    rerender();

    expect(result.current.emit).toBe(firstEmit);
    expect(result.current.on).toBe(firstOn);
  });

  it('should handle multiple event emissions', () => {
    const { result } = renderHook(() => useSocket());

    act(() => {
      result.current.emit('createGame', { name: 'Alice' });
      result.current.emit('startGame');
      result.current.emit('submitAnswer', { answer: 'test', responseTime: 1000 });
    });

    expect(mockEmit).toHaveBeenCalledTimes(3);
    expect(mockEmit).toHaveBeenNthCalledWith(1, 'createGame', { name: 'Alice' });
    expect(mockEmit).toHaveBeenNthCalledWith(2, 'startGame');
    expect(mockEmit).toHaveBeenNthCalledWith(3, 'submitAnswer', { answer: 'test', responseTime: 1000 });
  });

  it('should handle multiple event listeners', () => {
    const { result } = renderHook(() => useSocket());
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    act(() => {
      result.current.on('gameCreated', handler1);
      result.current.on('joinSuccess', handler2);
      result.current.on('roundStarted', handler3);
    });

    expect(mockOn).toHaveBeenCalledTimes(3);
    expect(mockOn).toHaveBeenNthCalledWith(1, 'gameCreated', handler1);
    expect(mockOn).toHaveBeenNthCalledWith(2, 'joinSuccess', handler2);
    expect(mockOn).toHaveBeenNthCalledWith(3, 'roundStarted', handler3);
  });
});
