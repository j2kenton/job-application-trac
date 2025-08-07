import React, { createContext, useContext, useEffect, useState } from 'react';
import { gmailAuth, AuthState } from '@/lib/gmail/GmailAuth';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null;
  accessToken: string | null;
  login: () => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial auth check
    const checkInitialAuth = async () => {
      try {
        const isAuthenticated = await gmailAuth.checkAuthStatus();
        const currentState = gmailAuth.getAuthState();
        setAuthState(currentState);
      } catch (error) {
        console.error('Initial auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkInitialAuth();

    // Subscribe to auth state changes
    const unsubscribe = gmailAuth.subscribe((state) => {
      setAuthState(state);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const success = await gmailAuth.authenticate();
      return success;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await gmailAuth.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    accessToken: authState.accessToken,
    login,
    logout,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
