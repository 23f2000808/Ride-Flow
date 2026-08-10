import { createContext, useEffect, useEffectEvent, useState } from 'react';
import apiClient, { configureAuthHandlers } from '../utils/apiClient';
import {
  clearStoredSession,
  getStoredSession,
  normalizeRole,
  persistSession,
  setAccessToken,
} from '../utils/auth';

export const AuthContext = createContext();

let refreshSessionRequest = null;

const requestSessionRefresh = async (remember = true) => {
  refreshSessionRequest ??= apiClient
    .post('/auth/refresh', { remember })
    .then((response) => response.data.data ?? response.data)
    .finally(() => {
      refreshSessionRequest = null;
    });

  return refreshSessionRequest;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rememberSession, setRememberSession] = useState(true);

  const applySession = ({ user: nextUser, accessToken, remember }) => {
    const normalizedUser = nextUser
      ? {
          ...nextUser,
          _id: nextUser._id || nextUser.id,
          id: nextUser.id || nextUser._id,
          role: normalizeRole(nextUser?.role),
        }
      : null;

    setUser(normalizedUser);
    setToken(accessToken || null);
    setAccessToken(accessToken || null);
    setRememberSession(Boolean(remember));

    if (normalizedUser) {
      persistSession({ user: normalizedUser, remember: Boolean(remember) });
    }
  };

  const clearSession = () => {
    setUser(null);
    setToken(null);
    setAccessToken(null);
    clearStoredSession();
  };

  const refreshSession = useEffectEvent(async () => {
    const payload = await requestSessionRefresh(rememberSession);
    applySession({
      user: payload.user,
      accessToken: payload.accessToken,
      remember: rememberSession,
    });

    return payload;
  });

  const logout = useEffectEvent(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Clear client state even if the server logout fails.
    } finally {
      clearSession();
    }
  });

  useEffect(() => {
    let isActive = true;

    const bootstrapAuth = async () => {
      const storedSession = getStoredSession();
      const remember = storedSession?.remember ?? true;

      if (storedSession && isActive) {
        setUser(storedSession.user);
        setRememberSession(Boolean(remember));
      }

      try {
        const payload = await requestSessionRefresh(remember);

        if (!isActive) {
          return;
        }

        applySession({
          user: payload.user,
          accessToken: payload.accessToken,
          remember,
        });
      } catch {
        if (storedSession && isActive) {
          clearSession();
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    bootstrapAuth();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession();
    };

    configureAuthHandlers({
      onRefresh: refreshSession,
      onLogout: logout,
    });

    window.addEventListener('rideflow:unauthorized', handleUnauthorized);
    return () => {
      configureAuthHandlers({ onRefresh: null, onLogout: null });
      window.removeEventListener('rideflow:unauthorized', handleUnauthorized);
    };
  }, [rememberSession]);

  const login = async ({ email, password, role, remember = true }) => {
    if (import.meta.env.DEV) {
      console.log('[auth] login request', {
        url: `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/login`,
        email,
        role,
      });
    }

    const response = await apiClient.post('/auth/login', { email, password, role, remember });
    const payload = response.data.data ?? response.data;
    applySession({
      user: payload.user,
      accessToken: payload.accessToken,
      remember,
    });

    return payload;
  };

  const signup = async ({
    name,
    email,
    password,
    role,
    phone,
    adminCode,
    extraFields = {},
    remember = true,
  }) => {
    const response = await apiClient.post('/auth/signup', {
      name,
      email,
      password,
      role,
      phone,
      adminCode,
      extraFields,
      remember,
    });
    const payload = response.data.data ?? response.data;
    applySession({
      user: payload.user,
      accessToken: payload.accessToken,
      remember,
    });

    return payload;
  };

  const updateUser = (nextUser) => {
    applySession({
      user: nextUser,
      accessToken: token,
      remember: rememberSession,
    });
  };

  const displayName = user?.name || user?.email || '';

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout, refreshSession, displayName, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
