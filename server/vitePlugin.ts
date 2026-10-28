/**
 * Melaka Heritage Hunt - Vite Server Plugin for NAS Photo Integration
 * Path: server/vitePlugin.ts
 */

import type { Plugin } from 'vite';
import { handleNasApi } from './apiRouter.ts';

export function nasApiPlugin(): Plugin {
  return {
    name: 'nas-photo-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/')) {
          try {
            const handled = await handleNasApi(req, res);
            if (handled) return;
          } catch (err) {
            console.error('Unhandled NAS API Middleware error:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal server error in NAS API handler' }));
            return;
          }
        }
        next();
      });
    },
  };
}
