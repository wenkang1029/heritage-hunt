import type { IncomingMessage, ServerResponse } from 'http';
import { handleNasApi } from '../server/apiRouter.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const handled = await handleNasApi(req, res);
  if (!handled) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
}
