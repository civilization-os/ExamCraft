import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import express from 'express';
import { apiRouter } from './api-router.js';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'model-core-api-middleware',
      configureServer(server) {
        const app = express();
        app.use(express.json({ limit: '5mb' }));
        app.use(express.urlencoded({ limit: '5mb', extended: true }));
        app.use('/api', apiRouter);
        server.middlewares.use(app);
      }
    }
  ],
  server: {
    port: 3000,
    open: false,
    host: '127.0.0.1'
  }
});
