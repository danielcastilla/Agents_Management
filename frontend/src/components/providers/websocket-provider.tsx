'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationStore } from '@/stores/notification-store';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (type: string, id: string) => void;
  unsubscribe: (type: string, id: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  subscribe: () => {},
  unsubscribe: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { accessToken, user } = useAuthStore();
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    if (!accessToken || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

    socketRef.current = io(`${wsUrl}/ws`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Handle notifications
    socket.on('notification', (data) => {
      addNotification(data.data || data);
    });

    // Handle system alerts
    socket.on('system:alert', (data) => {
      addNotification({
        id: data.data?.id || Date.now().toString(),
        type: data.data?.severity || 'warning',
        title: data.data?.title || 'System Alert',
        message: data.data?.message || '',
        read: false,
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [accessToken, user, addNotification]);

  const subscribe = (type: string, id: string) => {
    socketRef.current?.emit('subscribe', { type, id });
  };

  const unsubscribe = (type: string, id: string) => {
    socketRef.current?.emit('unsubscribe', { type, id });
  };

  return (
    <WebSocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        subscribe,
        unsubscribe,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}
