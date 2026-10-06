// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json) and handled by the Express app.
import type { IncomingMessage, ServerResponse } from 'node:http';

const appPromise = import('../server/index').then(m => m.default);

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPromise;
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
