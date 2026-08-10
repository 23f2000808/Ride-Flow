import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user, token } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user?.id || !token) {
      setSocket(null);
      return undefined;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    if (import.meta.env.DEV) {
      console.log('[socket] connect', { socketUrl, userId: user.id });
      newSocket.on('connect_error', (error) => {
        console.warn('[socket] connect_error', error.message);
      });
    }

    setSocket(newSocket);

    return () => {
      if (import.meta.env.DEV) {
        console.log('[socket] disconnect', { userId: user.id });
      }
      newSocket.removeAllListeners();
      newSocket.disconnect();
      setSocket(null);
    };
  }, [user?.id, token]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
}
