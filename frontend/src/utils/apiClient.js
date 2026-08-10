import axios from 'axios';
import { getStoredAuthToken } from './auth';

let refreshSessionHandler = null;
let logoutHandler = null;
let refreshPromise = null;

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredAuthToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const isAuthRoute = originalRequest?.url?.includes('/auth/login')
      || originalRequest?.url?.includes('/auth/refresh')
      || originalRequest?.url?.includes('/auth/logout');

    if (error?.response?.status === 401 && !originalRequest?._retry && !isAuthRoute && refreshSessionHandler) {
      originalRequest._retry = true;

      try {
        refreshPromise ??= refreshSessionHandler();
        await refreshPromise;
        refreshPromise = null;
        return apiClient(originalRequest);
      } catch (refreshError) {
        refreshPromise = null;
        if (logoutHandler) {
          await logoutHandler();
        } else {
          window.dispatchEvent(new CustomEvent('rideflow:unauthorized'));
        }
        return Promise.reject(refreshError);
      }
    }

    if (error?.response?.status === 401 && !isAuthRoute) {
      if (logoutHandler) {
        await logoutHandler();
      } else {
        window.dispatchEvent(new CustomEvent('rideflow:unauthorized'));
      }
    }

    return Promise.reject(error);
  }
);

export const configureAuthHandlers = ({ onRefresh, onLogout }) => {
  refreshSessionHandler = onRefresh;
  logoutHandler = onLogout;
};

export default apiClient;
