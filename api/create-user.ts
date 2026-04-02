// api/create-user.ts — Vercel Edge Function
// Creates a Supabase auth user and sends them a password setup email.
// Uses the service role key server-side — never exposed to the browser.

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl    = process.env.VITE_SUPABASE_URL;
  const appUrl         = process.env.VITE_APP_URL ?? 'https://strat101.vercel.app';

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

  const { email, password, username, fullName, sendInvite } = body;

  if (!email || !username || !fullName) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: email, username, fullName.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey':        serviceRoleKey,
  };

  if (sendInvite) {
    // ── Option A: Send invitation email — user sets their own password ─────────
    // First create the user
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        email_confirm:  true,
        user_metadata:  { username, full_name: fullName },
        // Set a random temp password — user will overwrite via invite link
        password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!1',
      }),
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
      return new Response(
        JSON.stringify({ error: createData.msg ?? createData.message ?? 'Failed to create user.' }),
        { status: createRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const authUserId = createData.id;

    // Generate a password recovery link so the user can set their own password
    const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
      method:  'PUT',
      headers,
      body: JSON.stringify({ email_confirm: true }),
    });

    // Send magic link / recovery email
    const recoveryRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({
        email,
        gotrue_meta_security: {},
      }),
    });

    return new Response(
      JSON.stringify({
        id:          authUserId,
        email:       createData.email,
        inviteSent:  recoveryRes.ok,
        message:     recoveryRes.ok
          ? `Account created and password setup email sent to ${email}`
          : `Account created but email could not be sent. Share credentials manually.`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } else {
    // ── Option B: Admin sets password directly — no email sent ────────────────
    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Password required when not sending invite.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        password,
        email_confirm:  true,
        user_metadata:  { username, full_name: fullName },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: data.msg ?? data.message ?? 'Failed to create auth user.' }),
        { status: res.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ id: data.id, email: data.email, inviteSent: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
