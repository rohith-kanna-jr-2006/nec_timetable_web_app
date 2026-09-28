import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  getMe as apiGetMe,
  getStoredUser,
  getStoredToken,
  getDefaultDashboard,
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getStoredToken());
  const [isLoading, setIsLoading] = useState(true);

  // Restore and validate session on initial mount
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedToken = getStoredToken();

      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const freshUser = await apiGetMe();
        if (isMounted) {
          setUser(freshUser);
          setToken(storedToken);
        }
      } catch (error) {
        console.warn('[AuthContext] Session restoration failed:', error.message);
        // If 401 or invalid, clear session
        if (error.status === 401 || error.code === 'TOKEN_EXPIRED') {
          apiLogout();
          if (isMounted) {
            setUser(null);
            setToken(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    try {
      const result = await apiLogin(email, password);
      setUser(result.user);
      setToken(result.token);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
    setToken(null);
  }, []);

  const hasRole = useCallback(
    (...allowedRoles) => {
      if (!user || !user.role) return false;
      return allowedRoles.includes(user.role);
    },
    [user]
  );

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    login,
    logout,
    hasRole,
    getDefaultDashboard,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
