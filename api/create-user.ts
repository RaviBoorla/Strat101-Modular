// api/create-user.ts — Vercel Edge Function
// Creates a Supabase auth user server-side using the service role key.
// Called by the admin console when adding a new user to a tenant.
// The service role key never touches the browser.

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl    = process.env.VITE_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured — missing Supabase credentials.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { email, password, username, fullName } = body;

  if (!email || !password || !username || !fullName) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: email, password, username, fullName.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Create the auth user using the Admin API (requires service role key)
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey':        serviceRoleKey,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,            // auto-confirm so they can log in immediately
      user_metadata: { username, full_name: fullName },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return new Response(
      JSON.stringify({ error: data.msg ?? data.message ?? 'Failed to create auth user.' }),
      { status: res.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Return the new auth user's UUID so the caller can update tenant_users
  return new Response(
    JSON.stringify({ id: data.id, email: data.email }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
