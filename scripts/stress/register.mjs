// Node loader for running src/ (written for Vite) directly:
// src/data/cluesZh.ts imports a .json file without `with { type: 'json' }`, which Node rejects.
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function load(url, context, next) {
        if (url.endsWith('.json')) return next(url, { ...context, importAttributes: { type: 'json' } });
        return next(url, context);
      }
    `)
);
