import { useCallback } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket-events';

export function useSocket() {
  const { socket, isConnected, isReconnecting, reconnectCount } = useSocketContext();

  const emit = useCallback(
    <E extends keyof ClientToServerEvents>(
      event: E,
      ...args: Parameters<ClientToServerEvents[E]>
    ) => {
      if (socket) {
        socket.emit(event, ...args);
      }
    },
    [socket]
  );

  const on = useCallback(
    <E extends keyof ServerToClientEvents>(
      event: E,
      handler: ServerToClientEvents[E]
    ) => {
      if (!socket) return () => {};
      // Socket.io's internal typing requires this assertion
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on(event, handler as any);
      return () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        socket.off(event, handler as any);
      };
    },
    [socket]
  );

  return { socket, isConnected, isReconnecting, reconnectCount, emit, on };
}
