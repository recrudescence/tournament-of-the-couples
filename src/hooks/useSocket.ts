import { useCallback } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket-events';

export function useSocket() {
  const { socket, isConnected } = useSocketContext();

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
      socket.on(event, handler as never);
      return () => {
        socket.off(event, handler as never);
      };
    },
    [socket]
  );

  return { socket, isConnected, emit, on };
}
