'use client';

import { ThemeProvider } from './theme-provider';
import { AuthProvider } from './auth-provider';
import { WebSocketProvider } from './websocket-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <WebSocketProvider>
          {children}
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
