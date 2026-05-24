import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (mode === 'production' && !env.VITE_API_URL) {
    throw new Error(
      '[vite] VITE_API_URL is not set.\n' +
      'Production builds require this variable.\n' +
      'Add it to client/.env.production or your hosting environment.'
    );
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
