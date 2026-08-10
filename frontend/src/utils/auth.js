const STORAGE_KEYS = {
  user: 'rideflow_user',
  remember: 'rideflow_remember',
};

let accessToken = null;

export const normalizeRole = (role) => {
  if (role === 'user') return 'customer';
  return role || 'customer';
};

export const getStorage = (remember = true) => (remember ? localStorage : sessionStorage);

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getStoredAuthToken = () => accessToken;

export const clearStoredSession = () => {
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.remember);
  sessionStorage.removeItem(STORAGE_KEYS.user);
  sessionStorage.removeItem(STORAGE_KEYS.remember);
  accessToken = null;
};

export const persistSession = ({ user, remember }) => {
  const storage = getStorage(remember);
  const otherStorage = remember ? sessionStorage : localStorage;

  otherStorage.removeItem(STORAGE_KEYS.user);
  otherStorage.removeItem(STORAGE_KEYS.remember);

  storage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  storage.setItem(STORAGE_KEYS.remember, JSON.stringify(remember));
};

export const decodeJwtPayload = (token) => {
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;

  return payload.exp * 1000 <= Date.now();
};

export const getStoredSession = () => {
  const storage = localStorage.getItem(STORAGE_KEYS.user) ? localStorage : sessionStorage;
  const storedUser = storage.getItem(STORAGE_KEYS.user);
  const storedRemember = storage.getItem(STORAGE_KEYS.remember);

  if (!storedUser) {
    return null;
  }

  const parsedUser = JSON.parse(storedUser);

  return {
    storage,
    user: { ...parsedUser, role: normalizeRole(parsedUser?.role) },
    remember: storedRemember ? JSON.parse(storedRemember) : storage === localStorage,
  };
};

export { STORAGE_KEYS };
