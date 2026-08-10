import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('\\react\\')) return 'react';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('socket.io-client')) return 'socket';
          if (
            id.includes('leaflet')
            || id.includes('react-leaflet')
            || id.includes('mapbox-gl')
            || id.includes('react-map-gl')
          ) {
            return 'maps';
          }
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/health': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/metrics': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
})
