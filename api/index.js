// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json) and handled by the Express app.
// The server is bundled into one ESM file during the build (npm run build:vercel), so Node never has to resolve
// the TypeScript sources' extension-less imports at runtime.
const appPromise = import('../server-dist/server.mjs').then(m => m.default);

export default async function handler(req, res) {
  const app = await appPromise;
  return app(req, res);
}
