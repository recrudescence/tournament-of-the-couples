import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket-events';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextValue {
  socket: TypedSocket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  /** Increments each time socket successfully reconnects (not initial connect) */
  reconnectCount: number;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const hasConnectedOnce = useRef(false);

  useEffect(() => {
    const newSocket: TypedSocket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      // If we've connected before, this is a reconnection
      if (hasConnectedOnce.current) {
        setReconnectCount(prev => prev + 1);
      }
      hasConnectedOnce.current = true;
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Track reconnection attempts
    newSocket.io.on('reconnect_attempt', () => {
      setIsReconnecting(true);
    });

    newSocket.io.on('reconnect_failed', () => {
      setIsReconnecting(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isReconnecting, reconnectCount }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}
