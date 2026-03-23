'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isLoading: false,
  isAuthenticated: true,
});

export const useAuth = () => useContext(AuthContext);

// Hardcoded admin user for development
const MOCK_USER = {
  id: 'admin-001',
  email: 'admin@agentsplatform.com',
  name: 'System Administrator',
  role: 'admin' as const,
  createdAt: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const { setUser, setTokens } = useAuthStore();

  useEffect(() => {
    // Auto-login with hardcoded admin user
    setUser(MOCK_USER);
    setTokens('mock-access-token', 'mock-refresh-token');
    setIsLoading(false);
  }, [setUser, setTokens]);

  return (
    <AuthContext.Provider value={{ isLoading, isAuthenticated: true }}>
      {children}
    </AuthContext.Provider>
  );
}
