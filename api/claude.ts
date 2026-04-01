// api/claude.ts — Vercel Edge Function
// Proxies requests to the Anthropic API so the key is never exposed
// in the browser bundle. Deployed automatically by Vercel when this
// file sits in the /api folder at the project root.

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Forward the request body to Anthropic unchanged
  const body = await req.json();

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.VITE_ANTHROPIC_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const data = await upstream.json();

  return new Response(JSON.stringify(data), {
    status:  upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
