// api/delete-user.ts — Vercel Edge Function
// Deletes a Supabase auth user using the service role key.
// Protected users (admins) cannot be deleted through this endpoint.

export const config = { runtime: 'edge' };

// Auth user IDs that can never be deleted via this endpoint
// Add the raviboorla auth UUID here as a hard safeguard
const PROTECTED_EMAILS = [
  'ravi.boorla@gmail.com',
];

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl    = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured — missing Supabase credentials.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: any;
  try { body = await req.json(); }
  catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { authUserId } = body;

  if (!authUserId) {
    return new Response(
      JSON.stringify({ error: 'Missing required field: authUserId.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Fetch the user first to check if they are protected ──────────────────
  const lookupRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${authUserId}`,
    {
      method:  'GET',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey':        serviceRoleKey,
      },
    }
  );

  if (lookupRes.ok) {
    const userData = await lookupRes.json();
    const userEmail = userData?.email ?? '';

    // Hard block — protected emails cannot be deleted
    if (PROTECTED_EMAILS.includes(userEmail.toLowerCase())) {
      return new Response(
        JSON.stringify({
          error: `User "${userEmail}" is a protected platform admin and cannot be deleted.`,
          protected: true,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // ── Delete from Supabase Auth ─────────────────────────────────────────────
  const res = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${authUserId}`,
    {
      method:  'DELETE',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey':        serviceRoleKey,
      },
    }
  );

  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    return new Response(
      JSON.stringify({ error: data.msg ?? data.message ?? 'Failed to delete auth user.' }),
      { status: res.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, authUserId }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
