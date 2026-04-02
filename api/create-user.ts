// api/create-user.ts — Vercel Edge Function
// Creates a Supabase auth user and sends an invitation email.
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

  // ── OPTION A: Send invitation email (user sets own password) ────────────────
  if (sendInvite) {

    // Step 1 — Use the Admin generateLink API to create an invite link
    // This creates the auth user AND generates a signup confirmation link
    // in one call, and Supabase sends the email automatically using
    // the configured SMTP and the "Invite" email template.
    const inviteRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/generate_link`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          type:        'invite',
          email,
          options: {
            data:         { username, full_name: fullName },
            redirect_to:  `${appUrl}/`,
          },
        }),
      }
    );

    const inviteData = await inviteRes.json();

    if (!inviteRes.ok) {
      // If user already exists, try sending a recovery email instead
      if (inviteData.code === 'email_exists' || inviteData.msg?.includes('already')) {
        const recoverRes = await fetch(
          `${supabaseUrl}/auth/v1/admin/generate_link`,
          {
            method: 'POST',
            headers: adminHeaders,
            body: JSON.stringify({
              type:  'recovery',
              email,
              options: { redirect_to: `${appUrl}/` },
            }),
          }
        );
        const recoverData = await recoverRes.json();
        if (recoverRes.ok) {
          return new Response(
            JSON.stringify({
              id:         recoverData.user?.id ?? null,
              email,
              inviteSent: true,
              message:    `Password reset email sent to ${email}`,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      return new Response(
        JSON.stringify({ error: inviteData.msg ?? inviteData.message ?? inviteData.error_description ?? 'Failed to send invite.' }),
        { status: inviteRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // inviteData contains: action_link, email_otp, hashed_token, redirect_to, verification_type, user
    return new Response(
      JSON.stringify({
        id:         inviteData.user?.id ?? null,
        email,
        inviteSent: true,
        message:    `Invitation email sent to ${email}`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── OPTION B: Admin sets password — no email sent ───────────────────────────
  if (!password) {
    return new Response(
      JSON.stringify({ error: 'Password required when not sending invite.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm:  true,
      user_metadata:  { username, full_name: fullName },
    }),
  });

  const createData = await createRes.json();

  if (!createRes.ok) {
    return new Response(
      JSON.stringify({ error: createData.msg ?? createData.message ?? 'Failed to create auth user.' }),
      { status: createRes.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ id: createData.id, email: createData.email, inviteSent: false }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
