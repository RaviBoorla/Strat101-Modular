// api/create-user.ts — Vercel Edge Function
// Creates a Supabase auth user and sends an invitation email via Supabase SMTP.
// Uses the service role key server-side — never exposed to the browser.

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Vercel Edge: env vars must NOT have VITE_ prefix — check both
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl    = process.env.SUPABASE_URL
                      ?? process.env.VITE_SUPABASE_URL;
  const appUrl         = (
    process.env.APP_URL ??
    process.env.VITE_APP_URL ??
    'https://strat101-modular.vercel.app'
  ).replace(/\/$/, '');

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(
      JSON.stringify({
        error: 'Server misconfigured — missing Supabase credentials.',
        debug: {
          hasServiceKey: !!serviceRoleKey,
          hasUrl: !!supabaseUrl,
          urlSource: process.env.SUPABASE_URL ? 'SUPABASE_URL' : process.env.VITE_SUPABASE_URL ? 'VITE_SUPABASE_URL' : 'none',
        }
      }),
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

  // ── Helper: find existing auth user by email ───────────────────────────────
  const findExistingUser = async (): Promise<string | null> => {
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`,
      { method: 'GET', headers: adminHeaders }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const found = (data?.users ?? []).find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );
    return found?.id ?? null;
  };

  // ── STEP 1: Create the auth user ───────────────────────────────────────────
  // If sendInvite=true  → create WITHOUT email_confirm so Supabase sends the invite email
  // If sendInvite=false → create with a set password, no email sent
  let authUserId: string | null = null;

  if (sendInvite) {
    // Use the invite endpoint — this creates the user AND sends the invite email
    // through your configured SMTP (Resend) in one step
    const inviteRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/generate_link`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          type:  'invite',
          email,
          options: {
            data:        { username, full_name: fullName },
            redirect_to: `${appUrl}/`,
          },
        }),
      }
    );

    const inviteData = await inviteRes.json();

    if (inviteRes.ok) {
      // generate_link returns the user object nested under .user or at top level
      authUserId = inviteData?.user?.id ?? inviteData?.id ?? null;

      // If id not in response, look up by email
      if (!authUserId) {
        authUserId = await findExistingUser();
      }

      return new Response(
        JSON.stringify({
          id: authUserId,
          email,
          inviteSent: true,
          message: `Invitation email sent to ${email}`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Invite failed — check if user already exists in auth
    if (
      inviteData.code === 'email_exists' ||
      inviteData.msg?.includes('already') ||
      inviteData.message?.includes('already') ||
      inviteData.error_code === 'email_exists'
    ) {
      authUserId = await findExistingUser();
      if (authUserId) {
        // User exists in auth but may have been removed from tenant_users
        // Update their metadata and send a magic link so they can set a new password
        await fetch(
          `${supabaseUrl}/auth/v1/admin/users/${authUserId}`,
          {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({
              user_metadata: { username, full_name: fullName },
              email_confirm: true,
            }),
          }
        );

        // Send magic link (OTP) — this goes through SMTP and lets them sign in
        const magicRes = await fetch(
          `${supabaseUrl}/auth/v1/admin/generate_link`,
          {
            method: 'POST',
            headers: adminHeaders,
            body: JSON.stringify({
              type:  'magiclink',
              email,
              options: { redirect_to: `${appUrl}/` },
            }),
          }
        );

        const magicData = await magicRes.json();
        return new Response(
          JSON.stringify({
            id: authUserId,
            email,
            inviteSent: magicRes.ok,
            message: magicRes.ok
              ? `Account already existed — sign-in link sent to ${email}`
              : `Account exists but email failed: ${magicData?.msg ?? 'unknown'}. Auth ID: ${authUserId}`,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: inviteData.msg ?? inviteData.message ?? inviteData.error_description ?? 'Failed to send invite.',
        debug: inviteData,
      }),
      { status: inviteRes.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── No invite — create with explicit password ──────────────────────────────
  const tempPwd = password ?? (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6).toUpperCase() + '!9'
  );

  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password:      tempPwd,
      email_confirm: true,
      user_metadata: { username, full_name: fullName },
    }),
  });

  const createData = await createRes.json();

  if (createRes.ok) {
    authUserId = createData.id ?? null;
  } else if (
    createData.code === 'email_exists' ||
    createData.msg?.includes('already') ||
    createData.message?.includes('already')
  ) {
    authUserId = await findExistingUser();
  } else {
    return new Response(
      JSON.stringify({ error: createData.msg ?? createData.message ?? 'Failed to create auth user.' }),
      { status: createRes.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!authUserId) {
    return new Response(
      JSON.stringify({ error: 'User created but UUID could not be retrieved.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ id: authUserId, email, inviteSent: false }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
