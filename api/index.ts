import type { IncomingMessage, ServerResponse } from 'http';
import app from '../src/app';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '/';
  if (url === '/api' || url === '/api/') {
    const hinted = req.headers['x-forwarded-uri'] || req.headers['x-vercel-original-url'];
    if (typeof hinted === 'string' && hinted.startsWith('/')) {
      req.url = hinted;
    }
  }
  return app(req, res);
}
