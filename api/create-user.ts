// api/create-user.ts — Vercel Edge Function
// Creates a Supabase auth user and optionally sends an invitation email.
// Uses the service role key server-side — never exposed to the browser.

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl    = process.env.VITE_SUPABASE_URL;
  const appUrl         = (process.env.VITE_APP_URL ?? 'https://strat101.vercel.app').replace(/\/$/, '');

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

  const adminHeaders = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey':        serviceRoleKey,
  };

  // ── Helper: look up existing auth user by email ───────────────────────────
  const findExistingUser = async (): Promise<string | null> => {
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=50`,
      { method: 'GET', headers: adminHeaders }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const users = data?.users ?? [];
    const found = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    return found?.id ?? null;
  };

  // ── STEP 1: Create the auth user ──────────────────────────────────────────
  // Always create with a random temp password so the account exists immediately.
  // If sendInvite=true, we then send a recovery link so they set their own password.
  const tempPwd = password ?? (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    '!9'
  );

  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password:       tempPwd,
      email_confirm:  true,         // auto-confirm so no email verification needed
      user_metadata:  { username, full_name: fullName },
    }),
  });

  const createData = await createRes.json();

  let authUserId: string | null = null;

  if (createRes.ok) {
    authUserId = createData.id ?? null;
  } else if (
    createData.code === 'email_exists' ||
    createData.msg?.includes('already') ||
    createData.message?.includes('already')
  ) {
    // User already exists — look up their UUID
    authUserId = await findExistingUser();
  } else {
    return new Response(
      JSON.stringify({ error: createData.msg ?? createData.message ?? 'Failed to create auth user.' }),
      { status: createRes.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!authUserId) {
    return new Response(
      JSON.stringify({ error: 'User was created but UUID could not be retrieved.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── STEP 2: Send invite email if requested ────────────────────────────────
  // Uses generate_link with type=recovery so they land on a "set password" page.
  // This goes through Supabase SMTP (configured with Resend).
  if (sendInvite) {
    const linkRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/generate_link`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          type:  'recovery',
          email,
          options: {
            redirect_to: `${appUrl}/`,
            data: { username, full_name: fullName },
          },
        }),
      }
    );

    const linkData = await linkRes.json();
    const inviteSent = linkRes.ok;

    return new Response(
      JSON.stringify({
        id:         authUserId,
        email,
        inviteSent,
        message: inviteSent
          ? `Account created and password setup email sent to ${email}`
          : `Account created but invite email failed: ${linkData?.msg ?? linkData?.error_description ?? 'unknown error'}. Share credentials manually.`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── No invite — just return the created user ──────────────────────────────
  return new Response(
    JSON.stringify({ id: authUserId, email, inviteSent: false }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
