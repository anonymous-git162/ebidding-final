import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'https://cenbidding-backend.onrender.com';

export function useSocket() {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<Function>>>(new Map());

  useEffect(() => {
    if (!user) return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('notification', (data: any) => {
      const listeners = listenersRef.current.get('notification');
      if (listeners) {
        listeners.forEach(fn => fn(data));
      }
    });

    socket.on('procurement:update', (data: any) => {
      const listeners = listenersRef.current.get('procurement:update');
      if (listeners) {
        listeners.forEach(fn => fn(data));
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const on = useCallback((event: string, callback: Function) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);

    return () => {
      listenersRef.current.get(event)?.delete(callback);
    };
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { on, emit, connected: socketRef.current?.connected || false };
}
