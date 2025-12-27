import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SocketProvider, useSocketContext } from '../SocketContext';

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('SocketContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SocketProvider', () => {
    it('creates socket on mount and provides it', async () => {
      const { result } = renderHook(() => useSocketContext(), {
        wrapper: SocketProvider,
      });

      await waitFor(() => {
        expect(result.current.socket).toBeTruthy();
      });
    });

    it('sets up connect event listener', () => {
      renderHook(() => useSocketContext(), {
        wrapper: SocketProvider,
      });

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('sets up disconnect event listener', () => {
      renderHook(() => useSocketContext(), {
        wrapper: SocketProvider,
      });

      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('updates isConnected to true on connect event', async () => {
      const { result } = renderHook(() => useSocketContext(), {
        wrapper: SocketProvider,
      });

      // Initially not connected
      expect(result.current.isConnected).toBe(false);

      // Simulate connect event
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];

      act(() => {
        if (connectHandler) connectHandler();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });

    it('updates isConnected to false on disconnect event', async () => {
      const { result } = renderHook(() => useSocketContext(), {
        wrapper: SocketProvider,
      });

      // First connect
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      )?.[1];

      act(() => {
        if (connectHandler) connectHandler();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Then disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1];

      act(() => {
        if (disconnectHandler) disconnectHandler();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });
    });

    it('provides socket instance', async () => {
      const { result } = renderHook(() => useSocketContext(), {
        wrapper: SocketProvider,
      });

      await waitFor(() => {
        expect(result.current.socket).toBe(mockSocket);
      });
    });

    it('disconnects socket on unmount', () => {
      const { unmount } = renderHook(() => useSocketContext(), {
        wrapper: SocketProvider,
      });

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('useSocketContext', () => {
    it('throws error when used outside SocketProvider', () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useSocketContext());
      }).toThrow('useSocketContext must be used within a SocketProvider');

      consoleError.mockRestore();
    });

    it('returns socket and isConnected when used within provider', async () => {
      const { result } = renderHook(() => useSocketContext(), {
        wrapper: SocketProvider,
      });

      await waitFor(() => {
        expect(result.current).toHaveProperty('socket');
        expect(result.current).toHaveProperty('isConnected');
      });
    });
  });
});
