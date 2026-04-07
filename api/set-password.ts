// api/set-password.ts — Vercel Edge Function
// Sets a user's Supabase Auth password using the service role key.
// Used for admin password resets and user-initiated password changes.

export const config = { runtime: 'edge' };

const PROTECTED_EMAILS = ['ravi.boorla@gmail.com'];

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl    = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured.' }),
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

  const { authUserId, password } = body;
  if (!authUserId || !password) {
    return new Response(
      JSON.stringify({ error: 'Missing authUserId or password.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (password.length < 8) {
    return new Response(
      JSON.stringify({ error: 'Password must be at least 8 characters.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const adminHeaders = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey':        serviceRoleKey,
  };

  // Fetch user to check if protected
  const userRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${authUserId}`,
    { method: 'GET', headers: adminHeaders }
  );

  if (userRes.ok) {
    const userData = await userRes.json();
    if (PROTECTED_EMAILS.includes(userData?.email?.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Cannot change password for protected admin via this endpoint.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Update the password
  const updateRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${authUserId}`,
    {
      method:  'PUT',
      headers: adminHeaders,
      body:    JSON.stringify({ password }),
    }
  );

  if (!updateRes.ok) {
    const data = await updateRes.json().catch(() => ({}));
    return new Response(
      JSON.stringify({ error: data.msg ?? data.message ?? 'Failed to update password.' }),
      { status: updateRes.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
