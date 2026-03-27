import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), basicSsl()],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']
  },
  server: {
    port: 5174,
    strictPort: true,
    host: '0.0.0.0',
    https: true,
    proxy: {
      '/ethos-api': {
        target: 'https://api.ethos.network',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ethos-api/, '/api/v2'),
        secure: true,
        cookieDomainRewrite: '',
        cookiePathRewrite: '/',
      },
    },
  }
});
